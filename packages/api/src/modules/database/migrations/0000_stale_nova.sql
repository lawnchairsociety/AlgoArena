CREATE TYPE "public"."borrow_tier" AS ENUM('easy', 'moderate', 'hard', 'not_shortable');--> statement-breakpoint
CREATE TYPE "public"."order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'filled', 'partially_filled', 'cancelled', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('market', 'limit', 'stop', 'stop_limit');--> statement-breakpoint
CREATE TYPE "public"."time_in_force" AS ENUM('day', 'gtc', 'ioc', 'fok');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cuid_users" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key_id" uuid NOT NULL,
	"label" text,
	"starting_balance" numeric(14, 2) DEFAULT '100000.00' NOT NULL,
	"cash_balance" numeric(14, 2) DEFAULT '100000.00' NOT NULL,
	"margin_used" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"pdt_enforced" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuid_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"side" "order_side" NOT NULL,
	"type" "order_type" NOT NULL,
	"time_in_force" time_in_force NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"filled_quantity" numeric(14, 6) DEFAULT '0' NOT NULL,
	"limit_price" numeric(14, 4),
	"stop_price" numeric(14, 4),
	"avg_fill_price" numeric(14, 4),
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"filled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"cuid_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"side" "order_side" NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"price" numeric(14, 4) NOT NULL,
	"total_cost" numeric(14, 2) NOT NULL,
	"filled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"cuid_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"avg_cost_basis" numeric(14, 4) NOT NULL,
	"total_cost_basis" numeric(14, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuid_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"entry_price" numeric(14, 4) NOT NULL,
	"borrow_rate" numeric(8, 4) NOT NULL,
	"borrow_tier" "borrow_tier" NOT NULL,
	"accrued_fees" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "borrow_fee_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"tier" "borrow_tier" NOT NULL,
	"annual_rate" numeric(8, 4) NOT NULL,
	"market_cap" numeric(20, 2),
	"short_interest_pct" numeric(8, 4),
	"days_to_cover" numeric(8, 2),
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuid_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"buy_order_id" uuid NOT NULL,
	"sell_order_id" uuid NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"buy_price" numeric(14, 4) NOT NULL,
	"sell_price" numeric(14, 4) NOT NULL,
	"trade_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuid_user_id" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"cash_balance" numeric(14, 2) NOT NULL,
	"positions_value" numeric(14, 2) NOT NULL,
	"total_equity" numeric(14, 2) NOT NULL,
	"day_pnl" numeric(14, 2) NOT NULL,
	"total_pnl" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuid_users" ADD CONSTRAINT "cuid_users_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cuid_user_id_cuid_users_id_fk" FOREIGN KEY ("cuid_user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_cuid_user_id_cuid_users_id_fk" FOREIGN KEY ("cuid_user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_cuid_user_id_cuid_users_id_fk" FOREIGN KEY ("cuid_user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrows" ADD CONSTRAINT "borrows_cuid_user_id_cuid_users_id_fk" FOREIGN KEY ("cuid_user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_trades" ADD CONSTRAINT "day_trades_cuid_user_id_cuid_users_id_fk" FOREIGN KEY ("cuid_user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_trades" ADD CONSTRAINT "day_trades_buy_order_id_orders_id_fk" FOREIGN KEY ("buy_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_trades" ADD CONSTRAINT "day_trades_sell_order_id_orders_id_fk" FOREIGN KEY ("sell_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_cuid_user_id_cuid_users_id_fk" FOREIGN KEY ("cuid_user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;