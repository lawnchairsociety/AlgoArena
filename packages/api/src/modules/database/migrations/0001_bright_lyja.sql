ALTER TABLE "orders" ADD COLUMN "asset_class" text DEFAULT 'us_equity' NOT NULL;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "asset_class" text DEFAULT 'us_equity' NOT NULL;