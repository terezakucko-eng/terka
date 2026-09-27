CREATE TYPE "public"."massage_booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."massage_payment" AS ENUM('on_site', 'transfer');--> statement-breakpoint
CREATE TABLE "massage_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "massage_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"service_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"price" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"payment" "massage_payment" NOT NULL,
	"paid_at" timestamp with time zone,
	"status" "massage_booking_status" DEFAULT 'confirmed' NOT NULL,
	"variable_symbol" integer GENERATED ALWAYS AS IDENTITY (sequence name "massage_bookings_variable_symbol_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 10001 CACHE 1),
	"guest_name" text,
	"guest_phone" text,
	"guest_email" text,
	"note" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "massage_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"price" integer NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "massage_services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "massage_bookings" ADD CONSTRAINT "massage_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "massage_bookings" ADD CONSTRAINT "massage_bookings_service_id_massage_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."massage_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "massage_availability_starts_idx" ON "massage_availability" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "massage_bookings_starts_idx" ON "massage_bookings" USING btree ("starts_at");