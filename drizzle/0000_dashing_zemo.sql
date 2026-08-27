CREATE TYPE "public"."resolution" AS ENUM('480p', '720p', '1080p');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('draft', 'planned', 'filmed', 'still_ready', 'queued', 'rendering', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_name" text NOT NULL,
	"product_category" text DEFAULT '' NOT NULL,
	"hook_angle" text DEFAULT '' NOT NULL,
	"has_sample" boolean DEFAULT false NOT NULL,
	"external_product_id" text,
	"character" jsonb,
	"beats" jsonb,
	"source_clip_url" text,
	"source_clip_seconds" real,
	"character_still_url" text,
	"prompt" text,
	"prompt_edited" boolean DEFAULT false NOT NULL,
	"fal_request_id" text,
	"status" "run_status" DEFAULT 'draft' NOT NULL,
	"result_url" text,
	"fal_error" text,
	"resolution" "resolution" DEFAULT '480p' NOT NULL,
	"seconds" integer DEFAULT 10 NOT NULL,
	"estimated_cost" integer,
	"actual_cost" integer,
	"posted" boolean DEFAULT false NOT NULL,
	"posted_at" timestamp with time zone
);
