-- The studio in one line on a Pošli to dál card's page: a family fitness studio with a wide choice of group classes
-- (no list of classes). A text saved in Obsah webu gets it too; with nothing saved the new default shows.
UPDATE "content" SET "value" = 'OCTOPUSH je rodinné fitness studio v Ostravě se širokým výběrem skupinových lekcí. Přátelská parta, malé skupiny a nikdo se tu s nikým nesrovnává.', "updated_at" = now()
WHERE "key" = 'passCard.about';
