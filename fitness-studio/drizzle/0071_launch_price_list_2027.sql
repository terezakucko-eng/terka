-- Po sloučení PR #95 (nový kód je na webu): do ceníku jdou členství bez závazku (prodej hned),
-- „Členství 2027“ a Členství Reformer (varianta B: 8× Reformer, 3 místa) – obě v prodeji od 1. 1. 2027.
UPDATE "products" SET "is_active" = true
WHERE "id" IN ('b3d1c4a2-6f0e-4c1b-9a57-2e8d5f7c9a10', 'f6e8d8e1-becd-4c1f-90c3-15f86465b278') AND "archived_at" IS NULL;--> statement-breakpoint
UPDATE "products" SET "is_active" = true
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "archived_at" IS NULL AND "included_per_month" = 8 AND "max_active" = 3;--> statement-breakpoint
-- Nadpis ceníku: jen „Ceník“ (rok je v záložkách).
INSERT INTO "content" ("key", "value", "updated_at") VALUES ('pricing.title', 'Ceník', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
