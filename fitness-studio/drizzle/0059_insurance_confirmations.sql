CREATE TABLE "insurance_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"name" text NOT NULL,
	"birth_date" text,
	"total" integer NOT NULL,
	"payments" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insurance_confirmations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "insurance_confirmations" ADD CONSTRAINT "insurance_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insurance_confirmations_user_idx" ON "insurance_confirmations" USING btree ("user_id","year");