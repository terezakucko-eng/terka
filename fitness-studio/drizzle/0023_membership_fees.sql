ALTER TYPE "public"."order_kind" ADD VALUE 'membership_fee';--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "monthly_fee" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "period" text;--> statement-breakpoint
CREATE INDEX "orders_period_idx" ON "orders" USING btree ("kind","period");