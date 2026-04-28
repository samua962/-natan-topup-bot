const express = require("express");
const router = express.Router();
const db = require("../../database/db");
const axios = require("axios");

// Helper: returns current active round or null
async function getCurrentRound() {
    const result = await db.query(
        "SELECT * FROM giveaway_rounds WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );
    return result.rows[0] || null;
}

// GET current round info (404 if none)
router.get("/current", async (req, res) => {
    try {
        const round = await getCurrentRound();
        if (!round) return res.status(404).json({ error: "No active giveaway round" });
        const tickets = await db.query("SELECT COUNT(*) FROM giveaway_tickets WHERE round_id = $1", [round.id]);
        res.json({ round, totalTickets: parseInt(tickets.rows[0].count), maxTickets: 1000 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set prize (only if active round exists)
router.put("/prize", async (req, res) => {
    const { prizeAmount } = req.body;
    if (prizeAmount === undefined || prizeAmount < 0) return res.status(400).json({ error: "Invalid prize amount" });
    try {
        const round = await getCurrentRound();
        if (!round) return res.status(404).json({ error: "No active giveaway round" });
        await db.query("UPDATE giveaway_rounds SET prize_amount = $1 WHERE id = $2", [prizeAmount, round.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List tickets (only for active round)
router.get("/tickets", async (req, res) => {
    try {
        const round = await getCurrentRound();
        if (!round) return res.status(404).json({ error: "No active giveaway round" });
        const tickets = await db.query(
            `SELECT t.ticket_number, t.user_id, t.created_at, u.username
             FROM giveaway_tickets t LEFT JOIN users u ON t.user_id = u.telegram_id
             WHERE t.round_id = $1 ORDER BY t.ticket_number ASC`,
            [round.id]
        );
        res.json(tickets.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pick winner (only if active round exists and has tickets)
router.post("/pick-winner", async (req, res) => {
    try {
        const round = await getCurrentRound();
        if (!round) return res.status(404).json({ error: "No active giveaway round" });
        const tickets = await db.query("SELECT user_id, ticket_number FROM giveaway_tickets WHERE round_id = $1", [round.id]);
        if (tickets.rows.length === 0) return res.status(400).json({ error: "No tickets" });
        const randomIndex = Math.floor(Math.random() * tickets.rows.length);
        const winner = tickets.rows[randomIndex];
        const prize = parseFloat(round.prize_amount);
        await db.query(
            `UPDATE giveaway_rounds SET status='completed', winner_id=$1, winner_ticket=$2, ended_at=CURRENT_TIMESTAMP WHERE id=$3`,
            [winner.user_id, winner.ticket_number, round.id]
        );
        // Add prize to wallet
        let wallet = await db.query("SELECT balance FROM user_wallets WHERE telegram_id = $1", [winner.user_id]);
        if (wallet.rows.length === 0) {
            await db.query("INSERT INTO user_wallets (telegram_id, balance) VALUES ($1, 0)", [winner.user_id]);
            wallet = { rows: [{ balance: 0 }] };
        }
        const oldBalance = parseFloat(wallet.rows[0].balance);
        const newBalance = oldBalance + prize;
        await db.query("UPDATE user_wallets SET balance = $1 WHERE telegram_id = $2", [newBalance, winner.user_id]);
        await db.query(
            `INSERT INTO transaction_history (telegram_id, type, amount, balance_before, balance_after, reference_id, description)
             VALUES ($1, 'GIVEAWAY', $2, $3, $4, $5, $6)`,
            [winner.user_id, prize, oldBalance, newBalance, round.id, `Giveaway prize (ticket ${winner.ticket_number})`]
        );
        // Notify winner and channel
        const botToken = process.env.BOT_TOKEN;
        const channel = process.env.CHANNEL_USERNAME;
        const api = `https://api.telegram.org/bot${botToken}`;
        await axios.post(`${api}/sendMessage`, {
            chat_id: winner.user_id,
            text: `🎉 Congratulations! You won the giveaway with ticket #${winner.ticket_number}!\n💰 Prize: ${prize} ETB has been added to your wallet.`,
            parse_mode: "Markdown",
        }).catch(e => console.error("DM fail"));
        if (channel) {
            await axios.post(`${api}/sendMessage`, {
                chat_id: `@${channel.replace("@","")}`,
                text: `🎊 GIVEAWAY WINNER ANNOUNCEMENT 🎊\n\nTicket #${winner.ticket_number} has won ${prize} ETB!\nCongratulations!`,
                parse_mode: "Markdown",
            }).catch(e => console.error("Channel fail"));
        }
        res.json({ success: true, winner: { user_id: winner.user_id, ticket: winner.ticket_number, prize } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Reset: end current active round (set to cancelled) and create a NEW active round
router.post("/reset", async (req, res) => {
    try {
        const current = await getCurrentRound();
        if (current) {
            await db.query("UPDATE giveaway_rounds SET status='cancelled', ended_at=CURRENT_TIMESTAMP WHERE id=$1", [current.id]);
        }
        await db.query("INSERT INTO giveaway_rounds (prize_amount, status) VALUES (0, 'active')");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deactivate: set current active round to 'inactive' (does not create new round)
router.post("/deactivate", async (req, res) => {
    try {
        const round = await getCurrentRound();
        if (!round) return res.status(404).json({ error: "No active round to deactivate" });
        await db.query("UPDATE giveaway_rounds SET status='inactive' WHERE id=$1", [round.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;