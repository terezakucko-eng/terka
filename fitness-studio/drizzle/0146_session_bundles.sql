CREATE TABLE "session_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "bundle_id" uuid;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_bundle_id_session_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."session_bundles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Zumba SPECIAL on Monday 16 Nov 2026: both lessons (Toning 17:00 + fitness 18:00) by one payment for 300 Kč, by card
-- or transfer. Credits, passes and memberships pay each lesson on its own as usual. Fixed id – created once.
INSERT INTO "session_bundles" ("id", "name", "price") VALUES ('3ba8adce-7a55-4a8c-a417-8cc60cc88cea', 'Zumba SPECIAL – obě lekce', 30000)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "class_sessions" SET "bundle_id" = '3ba8adce-7a55-4a8c-a417-8cc60cc88cea'
WHERE "id" IN ('5ea2983c-b146-45ae-b4b6-f86c43acc4c4', '00d2c63c-54d6-4248-a5a0-842b458b2e96') AND "bundle_id" IS NULL
  AND "status"::text <> 'cancelled' AND "title" LIKE '%SPECIAL';
--> statement-breakpoint
-- The lessons' note says it (unless it was edited meanwhile)…
UPDATE "class_sessions" SET "note" = 'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Uhradíš ji členstvím, permanentkou, kredity nebo jednorázově. Jdeš na obě? Balíček Toning + fitness vyjde na 300 Kč (kartou nebo převodem). Vstupy zdarma, včetně úvodního pro nováčky, tu neplatí.'
WHERE "id" IN ('5ea2983c-b146-45ae-b4b6-f86c43acc4c4', '00d2c63c-54d6-4248-a5a0-842b458b2e96')
  AND "note" = 'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Uhradíš ji členstvím, permanentkou, kredity nebo jednorázově – úvodní lekce zdarma ani jiné vstupy zdarma na ni použít nejdou.';
--> statement-breakpoint
-- …and so does the board post, under „Kolik to stojí?“: one line after the single price (as the studio edited it, or as
-- it was posted, with or without paragraphs in the list); nothing changes when it isn't there or the bundle is in already.
UPDATE "announcements" SET "body" = regexp_replace(regexp_replace("body",
    '(jednorázově 250[^<]*)</p></li>',
    '\1</p></li><li><p>balíček na obě za <strong>300 Kč</strong> – zaplatíš kartou nebo převodem</p></li>'),
    '(jednorázově 250[^<]*)</li>',
    '\1</li><li>balíček na obě za <strong>300 Kč</strong> – zaplatíš kartou nebo převodem</li>')
WHERE "id" = '146aa9e2-80ab-437c-b082-47ecb7403616' AND "body" LIKE '%jednorázově 250%' AND "body" NOT LIKE '%300 Kč%';
