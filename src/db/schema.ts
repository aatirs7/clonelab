import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const runStatusEnum = pgEnum("run_status", [
  "draft",
  "planned",
  "filmed",
  "still_ready",
  "queued",
  "rendering",
  "complete",
  "failed",
]);

export const resolutionEnum = pgEnum("resolution", ["480p", "720p", "1080p"]);

/**
 * The seven character fields from the spec. Stored as jsonb rather than columns
 * so a run can be reproduced exactly, and so adding an eighth field later is not
 * a migration.
 */
export type Character = {
  age: number;
  gender: string;
  profession: string;
  build: string;
  hair: string;
  outfit: string;
  product: string;
  /* Chosen during casting. Optional because characters cast before voices existed do not
     have one, and a run without a voice still works: the original audio is simply used. */
  voiceId?: string | null;
  voiceName?: string | null;
};

/**
 * An ordered timed movement cue. `at` and `duration` are the contract between the
 * teleprompter the operator films against and the timestamps the render prompt
 * claims, so they are the one thing in this app that must not drift.
 */
export type Beat = {
  at: number;
  duration: number;
  action: string;
  line: string | null;
};


/**
 * Kalodata's category id to name map. Rank endpoints filter by category_ids but never
 * return a category name, so the only way to label anything is to fetch the list once and
 * keep it. Cached per region because the taxonomy differs by market.
 */
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    categoryId: text("category_id").notNull(),
    name: text("name").notNull(),
    region: text("region").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_region_id_idx").on(t.region, t.categoryId)],
);

/** The six component scores, kept alongside the raw inputs that produced each one. */
export type ScoreComponent = {
  key: string;
  label: string;
  points: number;
  max: number;
  /** The bucket that was hit, in words, so a zero is explainable without rerunning anything. */
  reason: string;
};

/**
 * A product, as a record rather than a typed-in title.
 *
 * Everything from `region` down is a snapshot taken at pick time. Kalodata's numbers move
 * daily, so a score computed last week cannot be recomputed or audited later unless the
 * inputs that produced it were frozen with it. Whether a sample is on hand lives here too:
 * that is a fact about the product, not about one run of it.
 */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    kalodataProductId: text("kalodata_product_id"),
    name: text("name").notNull(),
    categoryId: text("category_id"),
    categoryName: text("category_name"),
    hasSample: boolean("has_sample").notNull().default(false),

    /* master_image_url from Kalodata, and a manual upload that overrides it when the
       Kalodata image is poor or the product never came through the picker. */
    imageUrl: text("image_url"),
    uploadedImageUrl: text("uploaded_image_url"),

    region: text("region"),
    currency: text("currency"),
    dateRange: text("date_range"),

    revenue: doublePrecision("revenue"),
    commissionRate: doublePrecision("commission_rate"),
    salesVolumn: integer("sales_volumn"),
    unitPrice: doublePrecision("unit_price"),
    /* Only ever present on rank, never on detail, so it has to be captured during the
       sweep. It cannot be backfilled afterwards. */
    revenueGrowthRate: doublePrecision("revenue_growth_rate"),
    liveRevenue: doublePrecision("live_revenue"),
    videoRevenue: doublePrecision("video_revenue"),
    showcaseRevenue: doublePrecision("showcase_revenue"),
    launchDate: text("launch_date"),
    sellerId: text("seller_id"),
    sellerName: text("seller_name"),

    scoreProfile: text("score_profile"),
    scoreTotal: integer("score_total"),
    scoreComponents: jsonb("score_components").$type<ScoreComponent[] | null>(),
    scoreInputs: jsonb("score_inputs").$type<Record<string, unknown> | null>(),
    pickedAt: timestamp("picked_at", { withTimezone: true }),
  },
  (t) => [index("products_kalodata_idx").on(t.kalodataProductId)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  /* The product is a record now. Category and whether a sample is on hand come from it.
     The angle stays on the run: it is a creative call about one video, and nothing in
     Kalodata supplies it. */
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  hookAngle: text("hook_angle").notNull().default(""),

  character: jsonb("character").$type<Character | null>(),
  beats: jsonb("beats").$type<Beat[] | null>(),

  sourceClipUrl: text("source_clip_url"),
  // Measured before upload. fal bills input duration alongside output, so this is
  // a cost input and not just metadata.
  sourceClipSeconds: real("source_clip_seconds"),
  characterStillUrl: text("character_still_url"),

  prompt: text("prompt"),
  promptEdited: boolean("prompt_edited").notNull().default(false),

  falRequestId: text("fal_request_id"),
  status: runStatusEnum("status").notNull().default("draft"),
  resultUrl: text("result_url"),
  falError: text("fal_error"),

  // 480p by default. Promotion to 720p is a deliberate second act on a take the
  // operator already likes, because it is roughly three times the money.
  resolution: resolutionEnum("resolution").notNull().default("480p"),
  seconds: integer("seconds").notNull().default(10),

  // Integer cents. Floats drift once you start summing them for the money rollup.
  estimatedCost: integer("estimated_cost"),
  actualCost: integer("actual_cost"),
  /*
    Commission actually earned from the posted video, entered by hand at the finish step.
    Nothing in the pipeline can know this: fal reports what a render cost, and TikTok
    reports what a video earned, and the two never meet. Without it the money view could
    only ever count spend, which made a cost line look like progress toward a revenue goal.
  */
  commissionEarned: integer("commission_earned"),

  /* The re-voiced audio track, converted from the original take. Dropped into CapCut
     alongside the render instead of the raw voice. */
  voicedAudioUrl: text("voiced_audio_url"),

  posted: boolean("posted").notNull().default(false),
  postedAt: timestamp("posted_at", { withTimezone: true }),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

/**
 * Reference creative saved against a run. There was nowhere in a run to keep the videos
 * you are trying to learn from, so the shortlist is that place.
 */
export const referenceVideos = pgTable(
  "reference_videos",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    title: text("title"),
    creatorHandle: text("creator_handle"),
    revenue: doublePrecision("revenue"),
    views: doublePrecision("views"),
    aiVideo: boolean("ai_video").notNull().default(false),
    ad: boolean("ad").notNull().default(false),
    note: text("note"),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reference_videos_run_video_idx").on(t.runId, t.videoId)],
);

/**
 * Cached video/rank results per category and window.
 *
 * Sweeping every category is one rank call each, and the rank limit is ten per ten
 * seconds, so this cannot run per page load. The cron refreshes it daily and every page
 * load reads the cache.
 */
export const categoryVideoCache = pgTable(
  "category_video_cache",
  {
    id: serial("id").primaryKey(),
    categoryId: text("category_id").notNull(),
    dateRange: text("date_range").notNull(),
    region: text("region").notNull(),
    videos: jsonb("videos").$type<unknown[]>().notNull(),
    aiCount: integer("ai_count").notNull().default(0),
    videoCount: integer("video_count").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("category_video_cache_idx").on(t.region, t.categoryId, t.dateRange)],
);

/** Shops the operator is watching for a spend push starting or stopping. */
export const watchedShops = pgTable(
  "watched_shops",
  {
    id: serial("id").primaryKey(),
    shopId: text("shop_id").notNull(),
    shopName: text("shop_name"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watched_shops_idx").on(t.shopId)],
);

/**
 * One row per watched shop per day.
 *
 * ad_share is the headline: the proportion of a brand's earning videos that carry the ad
 * flag. A brand boosting nearly everything is a brand whose affiliates get reach they did
 * not pay for. The point of snapshotting daily is to catch that starting or stopping,
 * which a single reading cannot show.
 */
export const shopAdSnapshots = pgTable(
  "shop_ad_snapshots",
  {
    id: serial("id").primaryKey(),
    shopId: text("shop_id").notNull(),
    day: text("day").notNull(),
    adShare: doublePrecision("ad_share").notNull(),
    videoCount: integer("video_count").notNull(),
    adVideoCount: integer("ad_video_count").notNull(),
    medianAdsRoas: doublePrecision("median_ads_roas"),
    meanAdRevenueRatio: doublePrecision("mean_ad_revenue_ratio"),
    meanAdViewRatio: doublePrecision("mean_ad_view_ratio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shop_ad_snapshots_idx").on(t.shopId, t.day)],
);

export type ReferenceVideo = typeof referenceVideos.$inferSelect;
export type WatchedShop = typeof watchedShops.$inferSelect;
export type ShopAdSnapshot = typeof shopAdSnapshots.$inferSelect;
export type CategoryVideoCache = typeof categoryVideoCache.$inferSelect;
