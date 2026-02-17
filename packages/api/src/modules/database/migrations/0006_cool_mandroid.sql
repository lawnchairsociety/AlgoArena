CREATE TABLE "risk_controls" (
	"user_id" text PRIMARY KEY NOT NULL,
	"max_position_pct" numeric(6, 4) DEFAULT '0.25',
	"max_position_value" numeric(14, 2),
	"max_positions" integer DEFAULT 50,
	"max_order_value" numeric(14, 2),
	"max_order_quantity" numeric(14, 6),
	"max_price_deviation_pct" numeric(6, 4) DEFAULT '0.10',
	"max_daily_trades" integer DEFAULT 100,
	"max_daily_notional" numeric(14, 2),
	"max_daily_loss_pct" numeric(6, 4),
	"max_drawdown_pct" numeric(6, 4),
	"auto_flatten_on_loss" boolean DEFAULT false NOT NULL,
	"short_selling_enabled" boolean DEFAULT true NOT NULL,
	"max_short_exposure_pct" numeric(6, 4) DEFAULT '0.50',
	"max_single_short_pct" numeric(6, 4) DEFAULT '0.15',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"control_name" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"order_id" uuid
);
--> statement-breakpoint
ALTER TABLE "risk_controls" ADD CONSTRAINT "risk_controls_user_id_cuid_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_user_id_cuid_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cuid_users"("id") ON DELETE no action ON UPDATE no action;