-- Terms (if saved in the admin) match how booking works now: a drop-in is the client's once paid, a transfer
-- within 24 h, paid drop-ins and surcharges come back as credit, credit has a validity. Literal hours, not the new
-- placeholders, so the live site shows it right even before the code that fills them is deployed.
UPDATE "content" SET "value" = replace("value", '- Neuhrazená rezervace jednorázového vstupu se uvolní po {{platba_minut}} minutách.', '- Jednorázový vstup je rezervovaný až po zaplacení. Neuhrazená platba kartou se uvolní po {{platba_minut}} minutách. Převodem je nutné zaplatit do 24 hodin; když platba nedorazí včas, rezervace se zruší (nejpozději 3 hodiny před lekcí). Ranní lekci (začátek před 12:00) lze od 17:00 předchozího dne zaplatit jen kartou.'), "updated_at" = now()
WHERE "key" = 'terms.body';
--> statement-breakpoint
UPDATE "content" SET "value" = replace("value", '- Zruší-li lekci studio, vstup se vrací vždy. Jednorázový vstup zaplacený kartou je vrácen ve formě kreditu.', '- Zruší-li lekci studio, vstup se vrací vždy. Zaplacený jednorázový vstup i doplatek se vrací ve formě kreditu ve výši zaplacené částky. Platba, která dorazí až po zrušení rezervace, se také připíše jako kredit.'), "updated_at" = now()
WHERE "key" = 'terms.body';
--> statement-breakpoint
UPDATE "content" SET "value" = replace("value", '- Kredit je nepřenosný a nepropadá. 1 kredit odpovídá ceně uvedené u lekce.', '- Kredit je nepřenosný. Má-li omezenou platnost (uvedenou v ceníku u dobití), každé dobití ji prodlouží pro celý zůstatek a kredit vrácený za zrušenou lekci platí nejméně 60 dní. 1 kredit odpovídá ceně uvedené u lekce.'), "updated_at" = now()
WHERE "key" = 'terms.body';
