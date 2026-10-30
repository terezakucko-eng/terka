-- The card's welcome e-mail, if the studio saved its own text: the muddled sentence about the friend's
-- place becomes the clear one (the default text needs nothing – it lives in the code).
UPDATE "content"
SET "value" = replace(
    "value",
    'Kartičku můžeš předat dál hned – jestli na ní zbývá místo pro kamarádku, uvidíš v účtu: {{ucet}}',
    'Na kartičce máš dva vstupy zdarma – jeden je tvůj a druhý můžeš předat kamarádce, ať jdete spolu. Stačí jí poslat odkaz ze svého účtu: {{ucet}}
Pokud druhý vstup nevyužiješ, klikni v účtu na „Přijdu sama“ a kartičku pošli hned někomu dál.'
  ),
  "updated_at" = now()
WHERE "key" = 'emails.welcomePassCard.body'
  AND "value" LIKE '%jestli na ní zbývá místo pro kamarádku%';
