CREATE TABLE "category_video_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"date_range" text NOT NULL,
	"region" text NOT NULL,
	"videos" jsonb NOT NULL,
	"ai_count" integer DEFAULT 0 NOT NULL,
	"video_count" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"video_id" text NOT NULL,
	"title" text,
	"creator_handle" text,
	"revenue" double precision,
	"views" double precision,
	"ai_video" boolean DEFAULT false NOT NULL,
	"ad" boolean DEFAULT false NOT NULL,
	"note" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_ad_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"day" text NOT NULL,
	"ad_share" double precision NOT NULL,
	"video_count" integer NOT NULL,
	"ad_video_count" integer NOT NULL,
	"median_ads_roas" double precision,
	"mean_ad_revenue_ratio" double precision,
	"mean_ad_view_ratio" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watched_shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"shop_name" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reference_videos" ADD CONSTRAINT "reference_videos_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_video_cache_idx" ON "category_video_cache" USING btree ("region","category_id","date_range");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_videos_run_video_idx" ON "reference_videos" USING btree ("run_id","video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_ad_snapshots_idx" ON "shop_ad_snapshots" USING btree ("shop_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "watched_shops_idx" ON "watched_shops" USING btree ("shop_id");