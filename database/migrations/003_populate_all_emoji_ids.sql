-- Populate all emoji IDs for products based on category and name patterns

-- PUBG products (category 1) - Use PUBG UC emoji
UPDATE products SET emoji_id = '5431449001532594346' WHERE category_id = 1 AND (name ILIKE '%uc%' OR name ILIKE '%grospack%' OR name ILIKE '%sub%');

-- Free Fire products (category 2) - Use Free Fire emoji
UPDATE products SET emoji_id = '6208452093397699863' WHERE category_id = 2 AND (name ILIKE '%diamond%' OR name ILIKE '%global%');

-- Google Play / Gift Cards (category 4) - Use Gift emoji or other 
UPDATE products SET emoji_id = '5327982530702359565' WHERE category_id = 4;

-- Telegram Premium (category 5) - Use Telegram Premium emoji
UPDATE products SET emoji_id = '5458399663616958662' WHERE category_id = 5;

-- TikTok Coins (category 6) - Use TikTok Coins emoji
UPDATE products SET emoji_id = '5327982530702359565' WHERE category_id = 6 AND (name ILIKE '%coin%' OR name ILIKE '%50%');
