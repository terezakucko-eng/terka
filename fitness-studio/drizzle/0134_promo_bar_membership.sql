-- The bar at the top of the web: the brunch is over, now membership 2027 – sign up by 30 Nov and Fitness Ježíšek
-- comes in December; the link leads to the board post with everything. Shown until 30 Nov, no live places
-- (the link isn't a lesson). A new text, so it shows again to those who closed the brunch one.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('promoBar.text', '🎁 Členství na rok 2027: přihlas se do 30. 11. a v prosinci přijde Fitness Ježíšek 🎅', now()),
  ('promoBar.linkLabel', 'Všechno na nástěnce', now()),
  ('promoBar.linkUrl', '/nastenka#ec9596c8-12e0-4cf2-97ff-d54610740a2d', now()),
  ('promoBar.until', '2026-11-30', now()),
  ('promoBar.showSpots', '', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
