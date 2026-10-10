-- Payments only through the booking system (no card terminal at reception): fix the texts 0044 wrote, if saved in the admin.
UPDATE "content" SET "value" = 'Platba', "updated_at" = now()
WHERE "key" = 'pricing.info3Title' AND "value" = 'Na recepci';
--> statement-breakpoint
UPDATE "content"
SET "value" = replace("value", 'Permanentky, členství i kredit koupíš také kartou přímo ve studiu. Hotovost nepřijímáme.', 'Platíš jen přes rezervační systém – kartou online nebo převodem (QR platbou). Hotovost nepřijímáme.'),
  "updated_at" = now()
WHERE "key" = 'pricing.info3Text';
--> statement-breakpoint
UPDATE "content"
SET "value" = replace("value", 'Platby přijímáme pouze bezhotovostně – kartou (na recepci i online), převodem nebo QR platbou. Hotovost nepřijímáme.', 'Platby přijímáme pouze bezhotovostně přes rezervační systém na webu – kartou online nebo převodem (QR platbou). Hotovost nepřijímáme.'),
  "updated_at" = now()
WHERE "key" = 'terms.body';
