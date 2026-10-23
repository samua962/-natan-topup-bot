require("dotenv").config();
const db = require("../database/db");

const newKeys = [
    // Main menu
    { key: "browse_products",  label: "Browse Products button",    fallback: "🛒" },
    { key: "main_menu_btn",    label: "Main Menu button",          fallback: "🏠" },
    { key: "back_btn",         label: "Back button",               fallback: "◀️" },
    // Browse Products menu
    { key: "menu_games",       label: "Games menu button",         fallback: "🎮" },
    { key: "menu_giftcards",   label: "Gift Cards menu button",    fallback: "🎁" },
    { key: "menu_manual",      label: "Manual Top-ups button",     fallback: "🛠️" },
    // Games menu
    { key: "game_pubg",         label: "PUBG Mobile button",       fallback: "🔫" },
    { key: "game_free_fire",    label: "Free Fire button",         fallback: "🔥" },
    { key: "game_delta_force",  label: "Delta Force button",       fallback: "⚡" },
    { key: "game_blood_strike", label: "Blood Strike button",      fallback: "🩸" },
    { key: "game_genshin",      label: "Genshin Impact button",    fallback: "🌸" },
    // PUBG submenu
    { key: "pubg_grosspack",    label: "PUBG Gross Pack button",   fallback: "📦" },
    { key: "pubg_subscription", label: "PUBG Subscription button", fallback: "👑" },
    { key: "pubg_weekly",       label: "PUBG Weekly Deal button",  fallback: "🎉" },
    // Gift cards
    { key: "gc_playstation",   label: "PlayStation (US) button",   fallback: "🎮" },
    { key: "gc_xbox",          label: "Xbox (US) button",          fallback: "🟩" },
    { key: "gc_itunes",        label: "iTunes (US) button",        fallback: "🍎" },
    { key: "gc_roblox",        label: "Roblox (Global) button",    fallback: "🟥" },
    { key: "gc_google_play",   label: "Google Play (US) button",   fallback: "🔵" },
];

(async () => {
    for (const r of newKeys) {
        try {
            const res = await db.query(
                `INSERT INTO system_settings (setting_key, emoji_id, fallback_emoji, display_name, description, is_active)
                 VALUES ($1, NULL, $2, $3, $4, true)
                 ON CONFLICT (setting_key) DO NOTHING`,
                [r.key, r.fallback, r.label, r.label]
            );
            const inserted = res.rowCount > 0 ? "✅ inserted" : "⏭️  already exists";
            console.log(`  ${inserted}: ${r.key}`);
        } catch (err) {
            console.error(`  ❌ ${r.key}: ${err.message}`);
        }
    }
    console.log("\nDone — all emoji keys seeded.");
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
