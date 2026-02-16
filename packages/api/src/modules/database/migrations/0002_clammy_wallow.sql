ALTER TYPE "public"."order_type" ADD VALUE 'trailing_stop';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "trail_percent" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "trail_price" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "high_water_mark" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "trailing_stop_price" numeric(12, 4);