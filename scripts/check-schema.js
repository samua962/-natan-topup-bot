require("dotenv").config();
const db = require("../database/db");

(async () => {
    const r = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'system_settings'"
    );
    console.log("Columns:", r.rows.map(x => x.column_name).join(", "));

    // Also show a sample row
    const s = await db.query("SELECT * FROM system_settings LIMIT 1");
    console.log("Sample row:", JSON.stringify(s.rows[0], null, 2));
    process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
