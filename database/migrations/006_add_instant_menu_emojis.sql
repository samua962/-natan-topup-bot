-- Emoji settings for instant product menus.
-- These keys are read by bot/bot.js and can be edited in the admin Emoji Manager.
INSERT INTO system_settings (setting_key, emoji_id, fallback_emoji, display_name, description, is_active)
VALUES
    ('instant_uc', NULL, '⚡', 'Instant UC', 'PUBG instant UC menu button', true),
    ('instant_wow', NULL, '💎', 'Instant WOW Coins', 'PUBG WOW Coins menu button', true),
    ('instant_special', NULL, '🎁', 'Instant Special Packs', 'PUBG special packs menu button', true),
    ('instant_manual', NULL, '📦', 'Manual Top Up', 'Manual PUBG menu button', true),
    ('telegram_stars', NULL, '⭐', 'Telegram Stars', 'Telegram Stars menu button', true),
    ('telegram_premium', NULL, '👑', 'Telegram Premium', 'Telegram Premium menu button', true),
    ('instant_category_pubg', NULL, '⚡', 'PUBG Instant Category', 'PUBG instant category button', true),
    ('instant_category_free_fire', NULL, '🔥', 'Free Fire Instant Category', 'Free Fire instant category button', true),
    ('instant_category_delta_force', NULL, '🔫', 'Delta Force Instant Category', 'Delta Force instant category button', true),
    ('instant_category_blood_strike', NULL, '💥', 'Blood Strike Instant Category', 'Blood Strike instant category button', true),
    ('instant_category_telegram', NULL, '📱', 'Telegram Instant Category', 'Telegram instant category button', true)
ON CONFLICT (setting_key) DO NOTHING;