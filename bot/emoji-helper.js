/**
 * Emoji Helper Module
 * Manages custom emoji IDs and caching system
 */

const db = require("../database/db");

// Emoji cache storage
let emojiCache = {
    system: {}, // system settings emojis (wallet, orders, support, etc)
    categories: {}, // category emojis by category_id
    products: {}, // product emojis by product_id
    subcategories: {}, // subcategory emojis by subcategory_id
};

let emojiCacheReady = false;

/**
 * Load all emojis from database and cache them in memory
 * Called on bot startup
 */
async function loadEmojiCache() {
    try {
        console.log("📱 Loading emoji cache from database...");
        
        // Reset cache
        emojiCache = {
            system: {},
            categories: {},
            products: {},
            subcategories: {},
        };
        
        // Load system settings emojis
        const systemSettings = await db.query(
            "SELECT setting_key, emoji_id, fallback_emoji FROM system_settings WHERE is_active=true"
        );
        systemSettings.rows.forEach(row => {
            emojiCache.system[row.setting_key] = {
                id: row.emoji_id,
                fallback: row.fallback_emoji
            };
            console.log(`  📌 ${row.setting_key}: ${row.emoji_id}`);
        });
        
        // Load category emojis
        const categories = await db.query(
            "SELECT id, emoji_id FROM categories WHERE is_active=true AND emoji_id IS NOT NULL"
        );
        categories.rows.forEach(row => {
            emojiCache.categories[row.id] = row.emoji_id;
            console.log(`  📂 Category ${row.id}: ${row.emoji_id}`);
        });
        
        // Load product emojis
        const products = await db.query(
            "SELECT id, emoji_id FROM products WHERE is_active=true AND emoji_id IS NOT NULL"
        );
        products.rows.forEach(row => {
            emojiCache.products[row.id] = row.emoji_id;
        });
        
        // Load subcategory emojis
        const subcategories = await db.query(
            "SELECT id, emoji_id FROM subcategories WHERE is_active=true AND emoji_id IS NOT NULL"
        );
        subcategories.rows.forEach(row => {
            emojiCache.subcategories[row.id] = row.emoji_id;
        });
        
        emojiCacheReady = true;
        console.log(`✅ Emoji cache ready: ${Object.keys(emojiCache.system).length} system, ${Object.keys(emojiCache.categories).length} categories, ${Object.keys(emojiCache.products).length} products`);
        
        return true;
    } catch (error) {
        console.error("❌ Failed to load emoji cache:", error.message);
        emojiCacheReady = false;
        return false;
    }
}

/**
 * Get emoji by type and identifier
 * Returns emoji ID as a STRING for use with icon_custom_emoji_id
 * @param {string} type - 'system', 'category', 'product', or 'subcategory'
 * @param {string|number} identifier - key/id to look up
 * @returns {string} emoji ID as string, or null if not found
 */
function getEmoji(type, identifier) {
    try {
        if (!isCacheReady()) {
            console.warn("⚠️ Emoji cache not ready, using fallback");
        }
        
        let emojiId = null;
        
        if (type === 'system') {
            const emoji = emojiCache.system[identifier];
            emojiId = emoji && emoji.id ? emoji.id : null;
        } else if (type === 'category') {
            emojiId = emojiCache.categories[identifier];
        } else if (type === 'product') {
            emojiId = emojiCache.products[identifier];
        } else if (type === 'subcategory') {
            emojiId = emojiCache.subcategories[identifier];
        }
        
        // Return as string (Telegram API expects string for icon_custom_emoji_id)
        if (emojiId) {
            return String(emojiId).trim();
        }
        return null;
    } catch (error) {
        console.error("Error getting emoji:", error.message);
        return null;
    }
}

/**
 * Refresh emoji cache (called when admin updates emojis)
 */
async function refreshEmojiCache() {
    console.log("🔄 Refreshing emoji cache...");
    return await loadEmojiCache();
}

/**
 * Update a system emoji and refresh cache
 */
async function updateSystemEmoji(key, emojiId) {
    try {
        await db.query(
            `UPDATE system_settings SET emoji_id = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = $2`,
            [emojiId, key]
        );
        await refreshEmojiCache();
        return { success: true };
    } catch (error) {
        console.error("Error updating system emoji:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Check if emoji cache is ready
 */
function isCacheReady() {
    return emojiCacheReady;
}

/**
 * Get all system emoji settings
 */
function getAllSystemEmojis() {
    return emojiCache.system;
}

module.exports = {
    loadEmojiCache,
    getEmoji,
    refreshEmojiCache,
    updateSystemEmoji,
    isCacheReady,
    getAllSystemEmojis,
};
