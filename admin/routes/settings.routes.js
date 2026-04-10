const express = require("express");
const router = express.Router();
const db = require("../../database/db");

// GET all settings
router.get("/", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM settings");
        res.json(result.rows);
    } catch (error) {
        console.error("GET settings error:", error);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// UPDATE setting
router.post("/", async (req, res) => {
    const { key, value } = req.body;
    
    if (!key || !value) {
        return res.status(400).json({ error: "Key and value are required" });
    }

    try {
        await db.query(
            `INSERT INTO settings (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key)
             DO UPDATE SET value = $2`,
            [key, value]
        );

        res.json({ success: true, message: "Setting updated" });
    } catch (error) {
        console.error("UPDATE settings error:", error);
        res.status(500).json({ error: "Failed to update setting" });
    }
});

// GET payment methods specifically
router.get("/payment-methods", async (req, res) => {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='payment_info'");
        
        let paymentMethods = { methods: [] };
        if (result.rows[0]?.value) {
            try {
                paymentMethods = JSON.parse(result.rows[0].value);
            } catch (e) {
                console.error("Parse error:", e);
            }
        }
        
        res.json(paymentMethods);
    } catch (error) {
        console.error("GET payment methods error:", error);
        res.status(500).json({ error: "Failed to fetch payment methods" });
    }
});

// UPDATE payment methods
router.put("/payment-methods", async (req, res) => {
    const { methods } = req.body;
    
    if (!methods || !Array.isArray(methods)) {
        return res.status(400).json({ error: "Methods array is required" });
    }

    try {
        const paymentInfo = JSON.stringify({ methods });
        
        await db.query(
            `INSERT INTO settings (key, value)
             VALUES ('payment_info', $1)
             ON CONFLICT (key)
             DO UPDATE SET value = $1`,
            [paymentInfo]
        );

        res.json({ success: true, message: "Payment methods updated" });
    } catch (error) {
        console.error("UPDATE payment methods error:", error);
        res.status(500).json({ error: "Failed to update payment methods" });
    }
});

// GET main menu banner
router.get("/banner", async (req, res) => {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key='main_menu_banner'");
        const bannerUrl = result.rows[0]?.value || "https://assets-prd.ignimgs.com/2025/07/16/25-best-ps5-games-blogroll-1752704467824.jpg";
        res.json({ url: bannerUrl });
    } catch (error) {
        console.error("GET banner error:", error);
        res.status(500).json({ error: "Failed to fetch banner" });
    }
});

// UPDATE main menu banner
router.put("/banner", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        await db.query(
            `INSERT INTO settings (key, value)
             VALUES ('main_menu_banner', $1)
             ON CONFLICT (key)
             DO UPDATE SET value = $1`,
            [url]
        );

        res.json({ success: true, message: "Banner updated" });
    } catch (error) {
        console.error("UPDATE banner error:", error);
        res.status(500).json({ error: "Failed to update banner" });
    }
});

module.exports = router;