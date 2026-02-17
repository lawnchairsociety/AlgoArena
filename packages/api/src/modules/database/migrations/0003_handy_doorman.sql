ALTER TABLE "orders" ADD COLUMN "parent_order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bracket_group_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bracket_role" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "linked_order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "take_profit_limit_price" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stop_loss_stop_price" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stop_loss_limit_price" numeric(14, 4);