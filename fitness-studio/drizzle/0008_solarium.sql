ALTER TYPE "public"."entitlement_kind" ADD VALUE 'solarium';--> statement-breakpoint
ALTER TYPE "public"."product_kind" ADD VALUE 'solarium';--> statement-breakpoint
CREATE TABLE "solarium_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entitlement_id" uuid,
	"minutes" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "members_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "solarium_uses" ADD CONSTRAINT "solarium_uses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solarium_uses" ADD CONSTRAINT "solarium_uses_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solarium_uses" ADD CONSTRAINT "solarium_uses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solarium_uses_user_idx" ON "solarium_uses" USING btree ("user_id");