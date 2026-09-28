ALTER TYPE "public"."order_kind" ADD VALUE 'surcharge';--> statement-breakpoint
ALTER TYPE "public"."order_kind" ADD VALUE 'massage';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "massage_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_massage_booking_id_massage_bookings_id_fk" FOREIGN KEY ("massage_booking_id") REFERENCES "public"."massage_bookings"("id") ON DELETE set null ON UPDATE no action;