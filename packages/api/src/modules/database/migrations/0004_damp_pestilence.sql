ALTER TABLE "orders" ADD COLUMN "order_class" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "leg_group_id" uuid;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "option_type" text;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "strike_price" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "expiration" text;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "underlying_symbol" text;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "multiplier" numeric(6, 0) DEFAULT '1';