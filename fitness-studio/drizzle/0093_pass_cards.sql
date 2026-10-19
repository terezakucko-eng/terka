CREATE TABLE "pass_card_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pass_card_uses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pass_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"holder_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pass_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD CONSTRAINT "pass_card_uses_card_id_pass_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."pass_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD CONSTRAINT "pass_card_uses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD CONSTRAINT "pass_card_uses_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_cards" ADD CONSTRAINT "pass_cards_holder_id_users_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_card_uses_card_idx" ON "pass_card_uses" USING btree ("card_id");