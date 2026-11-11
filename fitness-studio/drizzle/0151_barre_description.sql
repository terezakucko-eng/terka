-- Barre není balet: posilování inspirované baletní technikou, pilates a zdravotním cvičením s prvky DNS, s pomůckami
-- (tyč, zátěžové míčky, gumička, jógové bločky). Jen když je popis pořád ten původní – vlastní úprava v adminu zůstane.
UPDATE "class_types" SET "description" = 'Barre není balet – je to posilování inspirované baletní technikou, pilates a zdravotním cvičením s prvky DNS. Cvičíš u tyče, se zátěžovými míčky, gumičkou i jógovými bločky. Drobné přesné pohyby zpevní hýždě, stehna a střed těla a srovnají držení těla. Tutu ani baletní průprava nejsou potřeba.'
WHERE ("slug" = 'barre' OR lower("name") = 'barre')
  AND "description" = 'Spojení baletu, pilates a posilování u tyče. Drobné přesné pohyby zpevní hýždě, stehna a střed těla a vytvarují postavu. Baletní průprava není potřeba.';
