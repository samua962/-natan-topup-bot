-- Per-unit delivery ledger for instant FZR top-ups.
-- Guarantees at most one FZR order per (order_id, unit_index), even if the
-- same bot order is delivered more than once (webhook retries, duplicate
-- admin retries, process restarts, etc).
CREATE TABLE IF NOT EXISTS fzr_delivery_units (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    unit_index INTEGER NOT NULL,
    category_id TEXT,
    offer_id TEXT,
    provider_order_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, unit_index)
);

CREATE INDEX IF NOT EXISTS idx_fzr_delivery_units_order_id ON fzr_delivery_units (order_id);
