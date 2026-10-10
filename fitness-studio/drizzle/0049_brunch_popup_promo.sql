-- Barre + Brunch (Sat 31 Oct 2026, 8:30, 8 places): pop-up with the poster + announcement bar, both until Friday 30 Oct.
-- The pop-up button leads to the class, so the live "spots left" hint shows under it.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.title', 'Barre + Brunch – sobota 31. 10. v 8:30, jen 8 míst', now()),
  ('popup.text', '', now()),
  ('popup.image', '/img/brunch-barre-31-10-v2.webp', now()),
  ('popup.buttonLabel', 'Rezervovat Barre + Brunch', now()),
  ('popup.buttonUrl', '/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c', now()),
  ('popup.buttonLabel2', '', now()),
  ('popup.buttonUrl2', '', now()),
  ('popup.until', '2026-10-30', now()),
  ('promoBar.text', 'Barre + Brunch v sobotu 31. 10. v 8:30 – jen 8 míst!', now()),
  ('promoBar.linkLabel', 'Rezervovat', now()),
  ('promoBar.linkUrl', '/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c', now()),
  ('promoBar.until', '2026-10-30', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
