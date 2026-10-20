DROP INDEX "runs_one_valid_ranked_per_day";--> statement-breakpoint
ALTER TABLE "daily_games" ADD COLUMN "kind" text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_games" ADD COLUMN "ends_at" timestamp with time zone;