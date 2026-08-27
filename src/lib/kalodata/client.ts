import "server-only";
import { z } from "zod";
import { acquire, classOf } from "./throttle";

/**
 * Kalodata Open API client.
 *
 * Two things about this API will bite anyone who assumes it behaves normally.
 *
 * First, the auth header is not documented anywhere. The docs only say "secret-key
 * authentication in headers" and give no example. It is `secret-key` (`X-API-KEY` also
 * works; `key`, `Authorization` and `api-key` do not). That was established empirically
 * from the two distinct error messages the server returns: "The key is not null or empty"
 * when it found no key at all, versus "The key is not allowed" when it found one and
 * rejected it.
 *
 * Second, and more dangerous: EVERY response is HTTP 200, including failures. An error
 * comes back as 200 with `success: false` and a code. Branching on the status code would
 * quietly turn an auth failure or a rate limit into an empty result set, which downstream
 * looks like "this category has no products" rather than "this call did not work".
 */

const BASE = "https://www.kalodata.com/openapi/v1/tiktok";

/** Documented set. `en` is not valid, it must be `en-US`. */
export const LANGUAGE = "en-US";
export const CURRENCY = "USD";
export const REGION = "US";

function key(): string {
  const value = process.env.KALODATA_KEY;
  if (!value) throw new Error("KALODATA_KEY is not set");
  return value;
}

export class KalodataError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "KalodataError";
  }
}

/**
 * The envelope every endpoint returns. `data` is validated by the caller's schema, and a
 * `success: false` body is thrown rather than parsed, so it can never be mistaken for an
 * empty list.
 */
function envelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean().nullish(),
    data: dataSchema.nullish(),
    message: z.string().nullish(),
    code: z.string().nullish(),
    cached: z.boolean().nullish(),
  });
}

async function call<T extends z.ZodTypeAny>(
  endpoint: string,
  body: Record<string, unknown>,
  dataSchema: T,
): Promise<z.infer<T>> {
  // Blocks until this endpoint class has room in its window. Cheaper than being told to
  // slow down, since a rejected call still costs a round trip and may still be billed.
  await acquire(classOf(endpoint));

  const response = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", "secret-key": key() },
    body: JSON.stringify({ region: REGION, language: LANGUAGE, currency: CURRENCY, ...body }),
    cache: "no-store",
  });

  // A non-200 is unexpected here but still has to be handled, since the API's own errors
  // do not use status codes at all.
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new KalodataError(`Response was not JSON (HTTP ${response.status})`, null, endpoint);
  }

  const parsed = envelope(dataSchema).safeParse(json);
  if (!parsed.success) {
    throw new KalodataError(`Response did not match the expected shape`, null, endpoint);
  }

  if (parsed.data.success !== true) {
    throw new KalodataError(
      parsed.data.message ?? "The call failed without a message",
      parsed.data.code ?? null,
      endpoint,
    );
  }

  return (parsed.data.data ?? []) as z.infer<T>;
}

/* ------------------------------------------------------------------ schemas */

/**
 * Their misspelling, kept verbatim. Renaming it here would mean a silent undefined the
 * first time anyone reads the field straight off a response.
 */
export const ProductRankRow = z.object({
  product_id: z.string(),
  product_name: z.string(),
  revenue: z.number().nullish(),
  commission_rate: z.number().nullish(),
  revenue_growth_rate: z.number().nullish(),
  sales_volumn: z.number().nullish(),
  unit_price: z.number().nullish(),
  live_revenue: z.number().nullish(),
  video_revenue: z.number().nullish(),
  showcase_revenue: z.number().nullish(),
  launch_date: z.string().nullish(),
  master_image_url: z.string().nullish(),
  seller_id: z.string().nullish(),
  seller_name: z.string().nullish(),
  sku_count: z.string().nullish(),
});
export type ProductRankRow = z.infer<typeof ProductRankRow>;

export const ProductDetail = z.object({
  product_id: z.string().nullish(),
  product_name: z.string().nullish(),
  product_shop_id: z.string().nullish(),
  pri_cate_id: z.string().nullish(),
  sec_cate_id: z.string().nullish(),
  ter_cate_id: z.string().nullish(),
  revenue: z.number().nullish(),
  video_revenue: z.number().nullish(),
  live_revenue: z.number().nullish(),
  sales_volumn: z.number().nullish(),
  creator_number: z.number().nullish(),
  video_number: z.number().nullish(),
  live_number: z.number().nullish(),
  commission_rate: z.number().nullish(),
  unit_price: z.number().nullish(),
  max_price: z.number().nullish(),
  min_price: z.number().nullish(),
  product_review_count: z.number().nullish(),
  launch_date: z.string().nullish(),
  master_image_url: z.string().nullish(),
  delivery_type: z.string().nullish(),
  shopping_mall_revenue: z.number().nullish(),
  /*
    One revenue figure per day, oldest first. Not objects with dates, despite what the
    field name suggests: it is a bare number[] whose length equals the day count of the
    window. Verified against the API rather than assumed, three ways: the sum equals the
    window's own revenue total, the last seven entries of a last30Day array are identical
    to a last7Day array, and a product that launched inside the window has leading zeros.

    It is ONLY returned when need_extra is true, which is undocumented. Without that flag
    the field is absent entirely, and every growth and durability score would silently be
    computed from nothing.
  */
  revenue_trend: z.array(z.number()).nullish(),
});
export type ProductDetail = z.infer<typeof ProductDetail>;

export const CreatorRankRow = z.object({
  creator_id: z.string(),
  creator_nickname: z.string().nullish(),
  creator_handle: z.string().nullish(),
  revenue: z.number().nullish(),
  revenue_growth_rate: z.number().nullish(),
  content_views: z.number().nullish(),
  creator_followers: z.number().nullish(),
  sales_volumn: z.number().nullish(),
  video_revenue: z.number().nullish(),
  live_revenue: z.number().nullish(),
});
export type CreatorRankRow = z.infer<typeof CreatorRankRow>;

export const VideoRankRow = z.object({
  video_id: z.string(),
  video_title: z.string().nullish(),
  belonged_creator_id: z.string().nullish(),
  belonged_creator_handle: z.string().nullish(),
  revenue: z.number().nullish(),
  views: z.number().nullish(),
  revenue_growth_rate: z.number().nullish(),
  ads_roas: z.number().nullish(),
  digg_count: z.number().nullish(),
  share_count: z.number().nullish(),
  comment_count: z.number().nullish(),
  ad_revenue_ratio: z.number().nullish(),
  ad_view_ratio: z.number().nullish(),
  creator_debut: z.boolean().nullish(),
  ad: z.boolean().nullish(),
  ai_video: z.boolean().nullish(),
});
export type VideoRankRow = z.infer<typeof VideoRankRow>;

export const CategoryRankRow = z.object({
  category_id: z.string(),
  category_name: z.string().nullish(),
  revenue: z.number().nullish(),
});
export type CategoryRankRow = z.infer<typeof CategoryRankRow>;

export const ShopRankRow = z.object({
  shop_id: z.string(),
  shop_name: z.string().nullish(),
  revenue: z.number().nullish(),
  sales_volumn: z.number().nullish(),
  product_number: z.number().nullish(),
});
export type ShopRankRow = z.infer<typeof ShopRankRow>;

/* ------------------------------------------------------------------ endpoints */

export type SortField = { field: string; type: "ASC" | "DESC" };

export type ProductRankInput = {
  dateRange?: string;
  sort?: SortField;
  pageSize?: number;
  pageNumber?: number;
  categoryIds?: string[];
  isAffiliate?: 0 | 1;
  commissionRate?: string;
  needImage?: 0 | 1 | 2;
  needExtra?: boolean;
  keyword?: string;
};

/** Capped at a 30 day window by the endpoint itself. detail is not. */
export async function productRank(input: ProductRankInput = {}): Promise<ProductRankRow[]> {
  return call(
    "/product/rank",
    {
      date_range: input.dateRange ?? "last7Day",
      sort_field: input.sort ?? { field: "revenue", type: "DESC" },
      page_size: input.pageSize ?? 100,
      page_number: input.pageNumber ?? 1,
      ...(input.categoryIds?.length ? { category_ids: input.categoryIds } : {}),
      ...(input.isAffiliate !== undefined ? { is_affiliate: input.isAffiliate } : {}),
      ...(input.commissionRate ? { commission_rate: input.commissionRate } : {}),
      ...(input.needImage !== undefined ? { need_image: input.needImage } : {}),
      ...(input.needExtra !== undefined ? { need_extra: input.needExtra } : {}),
      ...(input.keyword ? { keyword: input.keyword } : {}),
    },
    z.array(ProductRankRow),
  );
}

/**
 * Note the default window is last90Day, not last60Day.
 *
 * last60Day is the one named range this endpoint rejects: it returns code 500 with the
 * message "text" while lastDay, last7Day, last30Day, last90Day, last180Day, last365Day,
 * an explicit span and a natural month all succeed. That looks like a bug on their side,
 * so the scoring profile asks for 90 days instead, which is a longer trend anyway.
 *
 * needExtra defaults to true because revenue_trend does not come back without it.
 */
export async function productDetail(
  productId: string,
  dateRange = "last90Day",
  needImage: 0 | 1 | 2 = 1,
  needExtra = true,
): Promise<ProductDetail | null> {
  const data = await call(
    "/product/detail",
    { product_id: productId, date_range: dateRange, need_image: needImage, need_extra: needExtra },
    z.union([ProductDetail, z.array(ProductDetail)]),
  );
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function creatorRank(input: {
  productId?: string;
  shopId?: string;
  dateRange?: string;
  pageSize?: number;
}): Promise<CreatorRankRow[]> {
  return call(
    "/creator/rank",
    {
      date_range: input.dateRange ?? "last7Day",
      sort_field: { field: "revenue", type: "DESC" },
      page_size: input.pageSize ?? 100,
      page_number: 1,
      ...(input.productId ? { product_id: input.productId } : {}),
      ...(input.shopId ? { shop_id: input.shopId } : {}),
    },
    z.array(CreatorRankRow),
  );
}

/** Also capped at a 30 day window. */
export async function videoRank(input: {
  productId?: string;
  shopId?: string;
  categoryIds?: string[];
  dateRange?: string;
  pageSize?: number;
}): Promise<VideoRankRow[]> {
  return call(
    "/video/rank",
    {
      date_range: input.dateRange ?? "last7Day",
      sort_field: { field: "revenue", type: "DESC" },
      page_size: input.pageSize ?? 100,
      page_number: 1,
      ...(input.productId ? { product_id: input.productId } : {}),
      ...(input.shopId ? { shop_id: input.shopId } : {}),
      ...(input.categoryIds?.length ? { category_ids: input.categoryIds } : {}),
    },
    z.array(VideoRankRow),
  );
}

export async function categoryRank(dateRange = "last7Day"): Promise<CategoryRankRow[]> {
  return call(
    "/category/rank",
    {
      date_range: dateRange,
      sort_field: { field: "revenue", type: "DESC" },
      page_size: 100,
      page_number: 1,
    },
    z.array(CategoryRankRow),
  );
}

export async function shopRank(input: { dateRange?: string; pageSize?: number } = {}): Promise<ShopRankRow[]> {
  return call(
    "/shop/rank",
    {
      date_range: input.dateRange ?? "last7Day",
      sort_field: { field: "revenue", type: "DESC" },
      page_size: input.pageSize ?? 100,
      page_number: 1,
    },
    z.array(ShopRankRow),
  );
}
