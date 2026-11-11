ALTER TABLE "class_sessions" ADD COLUMN "drop_in_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "ribbon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Sunday 6 Dec 2026 18:00 Zumba becomes the charity class „Zumba pro Soničku“: 150 Kč, paid only by card or transfer
-- (no membership, pass, credit or free entry), with the pink ribbon. Only while it's still the plain scheduled class –
-- a class the studio has renamed or cancelled meanwhile stays as it is. Booking opens separately, once this code runs.
UPDATE "class_sessions"
SET "title" = 'Zumba pro Soničku',
    "drop_in_price" = 15000,
    "no_free_entry" = true,
    "drop_in_only" = true,
    "ribbon" = true,
    "note" = 'Benefiční lekce pro Soničku – slovenskou instruktorku Zumby, která rozdávala radost celé komunitě. Teď je řada na nás: celé vstupné jí pošleme, aby měla léčbu a zotavení o něco snazší a veselejší. 💗 Přispět můžeš i libovolnou částkou přes QR kód v našem příspěvku na Instagramu a Facebooku.'
WHERE "id" = '9ed16f85-b076-4f4c-957f-10cb52da3726'
  AND "starts_at" = '2026-12-06 18:00:00+01'
  AND "status"::text = 'scheduled'
  AND "title" IS NULL
  AND "drop_in_only" = false;
