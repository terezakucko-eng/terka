-- The studio takes no cash: update the pricing note and the payment clause of the terms if they were saved in the admin.
UPDATE "content"
SET "value" = replace("value", 'koupíš také hotově nebo kartou přímo ve studiu.', 'koupíš také kartou přímo ve studiu. Hotovost nepřijímáme.'),
  "updated_at" = now()
WHERE "key" = 'pricing.info3Text';
--> statement-breakpoint
UPDATE "content"
SET "value" = replace("value", 'Online platby zpracovává Stripe Payments Europe, Ltd.', 'Platby přijímáme pouze bezhotovostně – kartou (na recepci i online), převodem nebo QR platbou. Hotovost nepřijímáme. Online platby zpracovává Stripe Payments Europe, Ltd.'),
  "updated_at" = now()
WHERE "key" = 'terms.body' AND "value" NOT LIKE '%Hotovost nepřijímáme%';
