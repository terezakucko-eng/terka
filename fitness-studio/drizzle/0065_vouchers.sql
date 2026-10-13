CREATE TYPE "public"."voucher_kind" AS ENUM('product', 'amount');--> statement-breakpoint
ALTER TYPE "public"."order_kind" ADD VALUE 'voucher';--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" "voucher_kind" NOT NULL,
	"product_id" uuid,
	"title" text NOT NULL,
	"amount" integer NOT NULL,
	"credits" integer,
	"recipient_name" text,
	"message" text,
	"buyer_id" uuid,
	"order_id" uuid,
	"paid_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"redeemed_by" uuid,
	"cancelled_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vouchers_buyer_idx" ON "vouchers" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "vouchers_order_idx" ON "vouchers" USING btree ("order_id");