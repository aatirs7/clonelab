ALTER TABLE "runs" ALTER COLUMN "product_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "product_name";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "product_category";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "has_sample";--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "external_product_id";