CREATE TYPE "public"."booking_method" AS ENUM('credits', 'pass', 'membership', 'free', 'drop_in', 'free_class', 'admin');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_payment', 'confirmed', 'waitlist', 'cancelled', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('purchase', 'booking', 'refund', 'admin', 'bonus');--> statement-breakpoint
CREATE TYPE "public"."entitlement_kind" AS ENUM('pass', 'membership', 'free');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('product', 'drop_in', 'renewal');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'cancelled', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('credit_pack', 'pass', 'membership');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'instructor', 'admin');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "booking_status" NOT NULL,
	"method" "booking_method",
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"entitlement_id" uuid,
	"order_id" uuid,
	"late_cancel" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_type_id" uuid NOT NULL,
	"instructor_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"capacity" integer NOT NULL,
	"credit_cost" integer NOT NULL,
	"drop_in_price" integer,
	"is_free" boolean DEFAULT false NOT NULL,
	"room" text,
	"note" text,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"series_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"credit_cost" integer DEFAULT 1 NOT NULL,
	"drop_in_price" integer,
	"capacity" integer DEFAULT 12 NOT NULL,
	"color" text DEFAULT '#7F40FF' NOT NULL,
	"level" text DEFAULT 'Pro všechny' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"booking_id" uuid,
	"order_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "entitlement_kind" NOT NULL,
	"product_id" uuid,
	"order_id" uuid,
	"name" text NOT NULL,
	"entries_total" integer,
	"entries_used" integer DEFAULT 0 NOT NULL,
	"weekly_limit" integer,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"status" "entitlement_status" DEFAULT 'active' NOT NULL,
	"subscription_id" text,
	"renewal_cancelled" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"specialties" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"user_id" uuid NOT NULL,
	"kind" "order_kind" NOT NULL,
	"product_id" uuid,
	"session_id" uuid,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'CZK' NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"subscription_id" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "product_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"credits" integer,
	"entries" integer,
	"validity_days" integer,
	"weekly_limit" integer,
	"recurring" boolean DEFAULT false NOT NULL,
	"highlight" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"credit_balance" integer DEFAULT 0 NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"admin_note" text,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_active_unique" ON "bookings" USING btree ("user_id","session_id") WHERE "bookings"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "bookings_session_idx" ON "bookings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "class_sessions_starts_at_idx" ON "class_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "credit_tx_user_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entitlements_user_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_ref_idx" ON "orders" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");