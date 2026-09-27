ALTER TYPE "public"."entitlement_kind" ADD VALUE 'massage_pass';--> statement-breakpoint
ALTER TYPE "public"."massage_payment" ADD VALUE 'pass';--> statement-breakpoint
ALTER TYPE "public"."product_kind" ADD VALUE 'massage_pass';--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_entitlement_id_entitlements_id_fk";
--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "massage_service_id" uuid;--> statement-breakpoint
ALTER TABLE "massage_bookings" ADD COLUMN "entitlement_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "massage_service_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_massage_service_id_massage_services_id_fk" FOREIGN KEY ("massage_service_id") REFERENCES "public"."massage_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "massage_bookings" ADD CONSTRAINT "massage_bookings_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_massage_service_id_massage_services_id_fk" FOREIGN KEY ("massage_service_id") REFERENCES "public"."massage_services"("id") ON DELETE no action ON UPDATE no action;