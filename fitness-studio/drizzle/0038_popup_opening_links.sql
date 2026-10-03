-- Opening pop-up buttons go straight to the two sessions on 9 Oct 2026.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.buttonUrl', '/rozvrh/612e27f5-70ef-41e5-afd0-077de7c77f1a', now()),
  ('popup.buttonUrl2', '/rozvrh/845d2233-1ebb-41a8-ab6e-057dd0575d03', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
