-- Populate emoji IDs for categories and products based on the client's custom emojis
-- This migration populates initial emoji_id values for existing data

-- Gaming Products Category
UPDATE categories SET emoji_id = '5807693556910919020' WHERE name = 'pubg';
UPDATE categories SET emoji_id = '6208452093397699863' WHERE name = 'freefire';

-- Products emoji mapping
UPDATE products SET emoji_id = '5807693556910919020' WHERE name ILIKE '%PUBG%Mobile%' OR name ILIKE '%PUBG Main%';
UPDATE products SET emoji_id = '6222023537218032568' WHERE name ILIKE '%PUBG UC List%';
UPDATE products SET emoji_id = '5431449001532594346' WHERE name ILIKE '%Instant UC%';
UPDATE products SET emoji_id = '6208452093397699863' WHERE name ILIKE '%Free Fire%Main%';
UPDATE products SET emoji_id = '5471952986970267163' WHERE name ILIKE '%Free Fire%Diamond%';
UPDATE products SET emoji_id = '5334544901428229844' WHERE name ILIKE '%PUBG Royale%';
UPDATE products SET emoji_id = '5316739367178375735' WHERE name ILIKE '%PUBG Subscription%';

-- Specialized Packs
UPDATE products SET emoji_id = '5316610243281583471' WHERE name ILIKE '%Growth Pack%' OR name ILIKE '%First Purchase%';
UPDATE products SET emoji_id = '5318870899317831864' WHERE name ILIKE '%Upgradable Firearm%';
UPDATE products SET emoji_id = '5316674800935009613' WHERE name ILIKE '%Mythic Emblem%';

-- Social & Services
UPDATE products SET emoji_id = '5458399663616958662' WHERE name ILIKE '%Telegram Premium%';
UPDATE products SET emoji_id = '5327982530702359565' WHERE name ILIKE '%TikTok Coins%';

-- Note: Run the system_settings migration separately to insert system-level emojis for:
-- - wallet, orders, support, ticket, help, info, channel
