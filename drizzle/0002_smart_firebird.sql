CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kalodata_product_id" text,
	"name" text NOT NULL,
	"category_id" text,
	"category_name" text,
	"has_sample" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"uploaded_image_url" text,
	"region" text,
	"currency" text,
	"date_range" text,
	"revenue" double precision,
	"commission_rate" double precision,
	"sales_volumn" integer,
	"unit_price" double precision,
	"revenue_growth_rate" double precision,
	"live_revenue" double precision,
	"video_revenue" double precision,
	"showcase_revenue" double precision,
	"launch_date" text,
	"seller_id" text,
	"seller_name" text,
	"score_profile" text,
	"score_total" integer,
	"score_components" jsonb,
	"score_inputs" jsonb,
	"picked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "product_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_region_id_idx" ON "categories" USING btree ("region","category_id");--> statement-breakpoint
CREATE INDEX "products_kalodata_idx" ON "products" USING btree ("kalodata_product_id");--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;