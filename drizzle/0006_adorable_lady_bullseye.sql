ALTER TABLE "runs" ADD COLUMN "character_seed" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "character_roll" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "character_prompt" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "render_prompt_mode" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "render_prompt_strictness" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "render_prompt_extra" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "render_prompt" text;