/**
 * Exercises every endpoint the app uses, once, against the live API. Proves the client
 * parses real responses before any UI is built on top of it. Costs about four cents.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const k = await import("../src/lib/kalodata/client");

function head(label: string) {
  console.log(`\n=== ${label} ===`);
}

head("category/rank");
const cats = await k.categoryRank();
console.log(`${cats.length} categories. first five:`);
for (const c of cats.slice(0, 5)) console.log(`  ${c.category_id.padEnd(12)} ${c.category_name}`);

head("product/rank (affiliate, commission >=15)");
const products = await k.productRank({ isAffiliate: 1, commissionRate: ">=15", needImage: 1, needExtra: true, pageSize: 5 });
console.log(`${products.length} rows`);
const top = products[0];
console.log(`  top: ${top.product_name?.slice(0, 50)}`);
console.log(`  revenue=${top.revenue} commission_rate=${top.commission_rate} sales_volumn=${top.sales_volumn}`);
console.log(`  live=${top.live_revenue} video=${top.video_revenue} showcase=${top.showcase_revenue}`);
console.log(`  image=${top.master_image_url ? "yes" : "null"} seller=${top.seller_name ?? "null"}`);

head("product/detail (last60Day, for the trend array)");
const detail = await k.productDetail(top.product_id, "last60Day");
console.log(`  creator_number=${detail?.creator_number} video_number=${detail?.video_number}`);
console.log(`  categories: ${detail?.pri_cate_id}/${detail?.sec_cate_id}/${detail?.ter_cate_id}`);
console.log(`  revenue_trend points: ${detail?.revenue_trend?.length ?? 0}`);
if (detail?.revenue_trend?.length) {
  console.log(`  first trend point: ${JSON.stringify(detail.revenue_trend[0])}`);
  console.log(`  last  trend point: ${JSON.stringify(detail.revenue_trend.at(-1))}`);
}
console.log(`  has revenue_growth_rate? ${"revenue_growth_rate" in (detail ?? {})}`);

head("creator/rank filtered by that product");
const creators = await k.creatorRank({ productId: top.product_id, dateRange: "last7Day" });
console.log(`${creators.length} creators`);
for (const c of creators.slice(0, 3)) console.log(`  ${String(c.revenue).padStart(12)}  @${c.creator_handle}`);

head("video/rank filtered by that product");
const videos = await k.videoRank({ productId: top.product_id, dateRange: "last7Day" });
console.log(`${videos.length} videos`);
for (const v of videos.slice(0, 3)) {
  console.log(`  rev=${String(v.revenue).padStart(10)} views=${String(v.views).padStart(9)} ad=${v.ad} ai_video=${v.ai_video}  ${String(v.video_title).slice(0, 40)}`);
}
const aiCount = videos.filter((v) => v.ai_video).length;
const adCount = videos.filter((v) => v.ad).length;
console.log(`  ai_video: ${aiCount}/${videos.length}   ad-flagged: ${adCount}/${videos.length}`);

head("shop/rank");
const shops = await k.shopRank({ pageSize: 5 });
console.log(`${shops.length} shops. first three:`);
for (const s of shops.slice(0, 3)) console.log(`  ${s.shop_id} ${s.shop_name} rev=${s.revenue}`);

console.log("\nall endpoints parsed");
process.exit(0);
