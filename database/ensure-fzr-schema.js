const db = require("./db");

// Runs at startup. Safe to run many times: it only adds what is missing.
async function ensureFzrSchema() {
    await db.query(`CREATE TABLE IF NOT EXISTS fzr_delivery_units (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        unit_index INTEGER NOT NULL,
        category_id TEXT,
        offer_id TEXT,
        provider_order_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (order_id, unit_index)
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_fzr_delivery_units_order_id ON fzr_delivery_units (order_id)`);
    await db.query(`ALTER TABLE fzr_delivery_units ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'claimed'`);
    await db.query(`ALTER TABLE fzr_delivery_units ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP`);
    await db.query(`ALTER TABLE fzr_delivery_units ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2)`);
    console.log("✅ FZR schema check done");
}

module.exports = { ensureFzrSchema };
