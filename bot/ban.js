module.exports = function setupBan(bot, db) {
    const banned = new Set();
    const isAdmin = (ctx) => String(ctx.from && ctx.from.id) === String(process.env.ADMIN_ID);
    (async () => {
        await db.query("CREATE TABLE IF NOT EXISTS banned_users (telegram_id BIGINT PRIMARY KEY, banned_at TIMESTAMP DEFAULT NOW())");
        const r = await db.query("SELECT telegram_id FROM banned_users");
        r.rows.forEach((row) => banned.add(String(row.telegram_id)));
        console.log(`Loaded ${banned.size} banned users`);
    })().catch((e) => console.error("Ban init error:", e.message));
    bot.use((ctx, next) => {
        if (ctx.from && banned.has(String(ctx.from.id))) return;
        return next();
    });
    bot.command("ban", async (ctx) => {
        if (!isAdmin(ctx)) return;
        const id = (ctx.message.text.split(/\s+/)[1] || "").trim();
        if (!/^\d{5,15}$/.test(id)) return ctx.reply("Usage: /ban 123456789");
        try {
            await db.query("INSERT INTO banned_users (telegram_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
            banned.add(id);
            const w = await db.query("SELECT balance FROM user_wallets WHERE telegram_id = $1", [id]);
            const old = w.rows[0] ? w.rows[0].balance : 0;
            await db.query("UPDATE user_wallets SET balance = 0 WHERE telegram_id = $1", [id]);
            return ctx.reply(`🚫 Banned ${id}\n💰 Wallet was ${old} ETB, now 0.`);
        } catch (e) { return ctx.reply("❌ Ban failed: " + e.message); }
    });
    bot.command("unban", async (ctx) => {
        if (!isAdmin(ctx)) return;
        const id = (ctx.message.text.split(/\s+/)[1] || "").trim();
        if (!/^\d{5,15}$/.test(id)) return ctx.reply("Usage: /unban 123456789");
        try {
            await db.query("DELETE FROM banned_users WHERE telegram_id = $1", [id]);
            banned.delete(id);
            return ctx.reply(`✅ Unbanned ${id}`);
        } catch (e) { return ctx.reply("❌ Unban failed: " + e.message); }
    });
    bot.command("banned", async (ctx) => {
        if (!isAdmin(ctx)) return;
        const list = [...banned];
        return ctx.reply(list.length ? `🚫 Banned (${list.length}):\n` + list.join("\n") : "No banned users.");
    });
};
