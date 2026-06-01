const express = require("express");
const router = express.Router();
const db = require("../../database/db");
const { refreshEmojiCache } = require("../../bot/emoji-helper");

// GET all system emojis
router.get("/system", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, setting_key, emoji_id, fallback_emoji, display_name, description, is_active 
             FROM system_settings 
             ORDER BY setting_key`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("GET system emojis error:", error);
        res.status(500).json({ error: "Failed to fetch system emojis" });
    }
});

// UPDATE system emoji
router.put("/system/:id", async (req, res) => {
    const { emoji_id, fallback_emoji, is_active } = req.body;
    const { id } = req.params;

    if (!emoji_id) {
        return res.status(400).json({ error: "emoji_id is required" });
    }

    try {
        const result = await db.query(
            `UPDATE system_settings 
             SET emoji_id = $1, fallback_emoji = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [emoji_id, fallback_emoji || '•', is_active !== false, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Emoji setting not found" });
        }

        // Refresh cache in the bot
        await refreshEmojiCache();

        res.json({ success: true, emoji: result.rows[0] });
    } catch (error) {
        console.error("UPDATE system emoji error:", error);
        res.status(500).json({ error: "Failed to update emoji" });
    }
});

// GET category emojis
router.get("/categories", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, display_name, emoji_id 
             FROM categories 
             WHERE is_active=true
             ORDER BY position`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("GET category emojis error:", error);
        res.status(500).json({ error: "Failed to fetch category emojis" });
    }
});

// UPDATE category emoji
router.put("/categories/:id", async (req, res) => {
    const { emoji_id } = req.body;
    const { id } = req.params;

    if (!emoji_id) {
        return res.status(400).json({ error: "emoji_id is required" });
    }

    try {
        const result = await db.query(
            `UPDATE categories 
             SET emoji_id = $1
             WHERE id = $2
             RETURNING *`,
            [emoji_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Refresh cache in the bot
        await refreshEmojiCache();

        res.json({ success: true, category: result.rows[0] });
    } catch (error) {
        console.error("UPDATE category emoji error:", error);
        res.status(500).json({ error: "Failed to update category emoji" });
    }
});

// GET product emojis
router.get("/products", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, emoji_id 
             FROM products 
             WHERE is_active=true
             ORDER BY name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("GET product emojis error:", error);
        res.status(500).json({ error: "Failed to fetch product emojis" });
    }
});

// UPDATE product emoji
router.put("/products/:id", async (req, res) => {
    const { emoji_id } = req.body;
    const { id } = req.params;

    if (!emoji_id) {
        return res.status(400).json({ error: "emoji_id is required" });
    }

    try {
        const result = await db.query(
            `UPDATE products 
             SET emoji_id = $1
             WHERE id = $2
             RETURNING *`,
            [emoji_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Refresh cache in the bot
        await refreshEmojiCache();

        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error("UPDATE product emoji error:", error);
        res.status(500).json({ error: "Failed to update product emoji" });
    }
});

// GET subcategory emojis
router.get("/subcategories", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, display_name, emoji_id 
             FROM subcategories 
             WHERE is_active=true
             ORDER BY name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error("GET subcategory emojis error:", error);
        res.status(500).json({ error: "Failed to fetch subcategory emojis" });
    }
});

// UPDATE subcategory emoji
router.put("/subcategories/:id", async (req, res) => {
    const { emoji_id } = req.body;
    const { id } = req.params;

    if (!emoji_id) {
        return res.status(400).json({ error: "emoji_id is required" });
    }

    try {
        const result = await db.query(
            `UPDATE subcategories 
             SET emoji_id = $1
             WHERE id = $2
             RETURNING *`,
            [emoji_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Subcategory not found" });
        }

        // Refresh cache in the bot
        await refreshEmojiCache();

        res.json({ success: true, subcategory: result.rows[0] });
    } catch (error) {
        console.error("UPDATE subcategory emoji error:", error);
        res.status(500).json({ error: "Failed to update subcategory emoji" });
    }
});

module.exports = router;
