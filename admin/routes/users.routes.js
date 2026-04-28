const express = require("express");
const router = express.Router();
const db = require("../../database/db");

// GET all users (with pagination and search)
router.get("/", async (req, res) => {
    try {
        const { search, limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT id, telegram_id, username, created_at,
                   COALESCE((SELECT balance FROM user_wallets WHERE telegram_id = users.telegram_id), 0) as balance
            FROM users
        `;
        const params = [];
        if (search) {
            query += ` WHERE username ILIKE $1 OR telegram_id::text ILIKE $1`;
            params.push(`%${search}%`);
        }
        query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const users = await db.query(query, params);

        const countResult = await db.query(
            `SELECT COUNT(*) FROM users ${search ? `WHERE username ILIKE $1 OR telegram_id::text ILIKE $1` : ""}`,
            search ? [`%${search}%`] : []
        );
        res.json({
            users: users.rows,
            total: parseInt(countResult.rows[0].count),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;