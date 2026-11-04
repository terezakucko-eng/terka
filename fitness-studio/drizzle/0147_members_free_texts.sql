-- Zumba SPECIAL 16 Nov: members come without paying – said first in the lessons' note (unless edited meanwhile)…
UPDATE "class_sessions" SET "note" = 'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Členové ji mají v ceně, bez placení. Ostatní ji uhradí permanentkou, kredity nebo jednorázově. Jdeš na obě? Balíček Toning + fitness vyjde na 300 Kč (kartou nebo převodem). Vstupy zdarma, včetně úvodního pro nováčky, tu neplatí.'
WHERE "id" IN ('5ea2983c-b146-45ae-b4b6-f86c43acc4c4', '00d2c63c-54d6-4248-a5a0-842b458b2e96')
  AND "note" IN (
    'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Uhradíš ji členstvím, permanentkou, kredity nebo jednorázově. Jdeš na obě? Balíček Toning + fitness vyjde na 300 Kč (kartou nebo převodem). Vstupy zdarma, včetně úvodního pro nováčky, tu neplatí.',
    'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Uhradíš ji členstvím, permanentkou, kredity nebo jednorázově – úvodní lekce zdarma ani jiné vstupy zdarma na ni použít nejdou.'
  );
--> statement-breakpoint
-- …and on the board post under „Kolik to stojí?“ (the studio's own line, with or without its „!“).
UPDATE "announcements" SET "body" = replace("body", 'členové mají obě lekce v ceně členství', 'členové nic neplatí – obě lekce mají v ceně členství')
WHERE "id" = '146aa9e2-80ab-437c-b082-47ecb7403616' AND "body" LIKE '%členové mají obě lekce v ceně členství%';
