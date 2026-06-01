-- Add instant UC emoji to system_settings
INSERT INTO system_settings (setting_key, emoji_id, fallback_emoji, is_active)
VALUES ('uc_instant', '5832298509721673151', '⚡', true)
ON CONFLICT (setting_key) DO UPDATE SET 
  emoji_id = EXCLUDED.emoji_id,
  fallback_emoji = EXCLUDED.fallback_emoji,
  is_active = true;
