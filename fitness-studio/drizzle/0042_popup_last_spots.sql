-- Opening pop-up: "last spots" poster (new file name = no stale cache, and visitors who closed it see it once more).
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.title', 'Poslední volná místa na otevření 9. 10. – vstup zdarma pro všechny registrované', now()),
  ('popup.image', '/img/otevreni-posledni-mista.webp', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
