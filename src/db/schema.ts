import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
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

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // Product fields are inlined until Affiliate Engine is wired in. When it is,
  // externalProductId becomes the join and these become a denormalized snapshot.
  productName: text("product_name").notNull(),
  productCategory: text("product_category").notNull().default(""),
  hookAngle: text("hook_angle").notNull().default(""),
  hasSample: boolean("has_sample").notNull().default(false),
  externalProductId: text("external_product_id"),

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

  posted: boolean("posted").notNull().default(false),
  postedAt: timestamp("posted_at", { withTimezone: true }),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
