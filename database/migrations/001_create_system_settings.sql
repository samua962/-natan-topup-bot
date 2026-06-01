-- Create system_settings table for storing system-level emoji and settings
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    emoji_id TEXT,
    fallback_emoji VARCHAR(10),
    display_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system settings with emoji IDs
INSERT INTO system_settings (setting_key, emoji_id, fallback_emoji, display_name, description, is_active)
VALUES
    ('wallet', '5373200942827066245', '👛', 'My Wallet / Balance', 'Wallet and balance management', true),
    ('orders', '6109659543417917958', '📋', 'My Orders / History', 'View and manage orders', true),
    ('support', '4909043075529048789', '📞', 'Support', 'Customer support and help', true),
    ('ticket', '5377599075237502153', '🎟️', 'Get Ticket', 'Get giveaway ticket', true),
    ('help', '5436113877181941026', '❓', 'Help', 'Help and guide', true),
    ('info', '5334544901428229844', 'ℹ️', 'Info / About', 'About the bot', true),
    ('channel', '5271801931814165886', '📢', 'Our Channel', 'Official channel', true)
ON CONFLICT (setting_key) DO UPDATE SET
    emoji_id = EXCLUDED.emoji_id,
    fallback_emoji = EXCLUDED.fallback_emoji,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
