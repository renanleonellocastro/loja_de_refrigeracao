DROP INDEX "users_search_trgm_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "users_search_trgm_idx" ON "users" USING gin ("search_text" gin_trgm_ops);