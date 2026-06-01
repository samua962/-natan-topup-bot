-- Update system settings with correct emoji IDs from client
UPDATE system_settings SET emoji_id = '5832425752422784714' WHERE setting_key = 'wallet';
UPDATE system_settings SET emoji_id = '5830254848318120201' WHERE setting_key = 'help';
UPDATE system_settings SET emoji_id = '5830186617010292578' WHERE setting_key = 'support';
UPDATE system_settings SET emoji_id = '5830132596369008180' WHERE setting_key = 'ticket';
UPDATE system_settings SET emoji_id = '5832298509271673151' WHERE setting_key = 'channel';

-- Update categories with correct emoji IDs
UPDATE categories SET emoji_id = '5832616491920400224' WHERE name ILIKE '%pubg%';
UPDATE categories SET emoji_id = '5832424906314226866' WHERE name ILIKE '%free fire%';
UPDATE categories SET emoji_id = '5830133756010117427' WHERE name ILIKE '%telegram%';
UPDATE categories SET emoji_id = '5832298509271673151' WHERE name ILIKE '%tiktok%';

-- Update PUBG products with correct emoji ID
UPDATE products SET emoji_id = '5832616491920400224' WHERE category_id = 1;

-- Update Free Fire products with correct emoji ID
UPDATE products SET emoji_id = '5832424906314226866' WHERE category_id = 2;

-- Update Telegram Premium products with correct emoji ID
UPDATE products SET emoji_id = '5830133756010117427' WHERE category_id = 5;

-- Update TikTok products with correct emoji ID
UPDATE products SET emoji_id = '5832298509271673151' WHERE category_id = 6;

-- Update Bank/Financial products if any
UPDATE products SET emoji_id = '5832532509383492733' WHERE name ILIKE '%cbe bank%';
UPDATE products SET emoji_id = '5832449172879544998' WHERE name ILIKE '%abyssinia%';
UPDATE products SET emoji_id = '5830034165175882138' WHERE name ILIKE '%telebirr%';
UPDATE products SET emoji_id = '5832676350879605676' WHERE name ILIKE '%ebirr%';
UPDATE products SET emoji_id = '5830370524672302605' WHERE name ILIKE '%cbe birr%';
