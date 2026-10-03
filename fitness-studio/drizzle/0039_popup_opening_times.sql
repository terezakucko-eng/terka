-- Opening classes moved: Zumba Toning 16:30, Zumba fitness 17:30 (new banner file, so no stale image cache).
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.image', '/img/otevreni-1630.webp', now()),
  ('popup.buttonLabel', 'Rezervovat 16:30 Zumba Toning', now()),
  ('popup.buttonLabel2', 'Rezervovat 17:30 Zumba fitness', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
