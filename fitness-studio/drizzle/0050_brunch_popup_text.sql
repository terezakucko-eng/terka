-- Barre + Brunch: poster says "Pojďme si užít příjemné podzimní sobotní ráno." (new file = no stale cache); the bar no longer mentions the 8 places.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.image', '/img/brunch-barre-31-10-v2.webp', now()),
  ('promoBar.text', 'Barre + Brunch v sobotu 31. 10. v 8:30', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
