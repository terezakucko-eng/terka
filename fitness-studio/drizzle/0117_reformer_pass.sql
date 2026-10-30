ALTER TABLE "products" ADD COLUMN "class_type_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "shares_places_with" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shares_places_with_products_id_fk" FOREIGN KEY ("shares_places_with") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;