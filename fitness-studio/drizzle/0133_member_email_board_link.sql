-- The membership 2027 e-mail (still a draft) points to the board post too, as the studio wants – right above the
-- link to the price list. Only while it's a draft and only once.
UPDATE "campaigns" SET "body" = replace(
  "body",
  '**Zarezervuj si členství na rok 2027:** https://www.octopush.fit/cenik?rok=2027',
  '**Všechno o členství 2027 najdeš i na nástěnce:** https://www.octopush.fit/nastenka#ec9596c8-12e0-4cf2-97ff-d54610740a2d

**Zarezervuj si členství na rok 2027:** https://www.octopush.fit/cenik?rok=2027'
)
WHERE "id" = '1b19f3f2-85a4-450e-a725-1e2a51640f4f' AND "status"::text = 'draft' AND "body" NOT LIKE '%/nastenka#%';
