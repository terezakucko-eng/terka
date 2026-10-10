-- Brunch board post: the menu line without avocado toasts – "čerstvá zdravá snídaně, výběrová káva, čajík, matcha, džus nebo mimóza".
UPDATE "announcements"
SET "body" = replace("body", '🥑 avokádové toasty, čerstvé ovoce, matcha a výběrová káva', '🥐 čerstvá zdravá snídaně, výběrová káva, čajík, matcha, džus nebo mimóza')
WHERE "id" = '0ed75e1b-a3cc-4b2c-9058-8cac246c731f';
