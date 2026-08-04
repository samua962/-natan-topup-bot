-- Step 1: Reject duplicate orders — keep the best one per transaction_id.
-- "Best" = highest status priority (COMPLETED > APPROVED > PENDING), then highest id.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY lower(transaction_id)
            ORDER BY
                CASE status
                    WHEN 'COMPLETED' THEN 1
                    WHEN 'APPROVED'  THEN 2
                    ELSE 3
                END ASC,
                id DESC
        ) AS rn
    FROM orders
    WHERE transaction_id IS NOT NULL
      AND transaction_id <> ''
      AND status IN ('PENDING', 'APPROVED', 'COMPLETED')
)
UPDATE orders
SET status = 'REJECTED',
    note   = 'Duplicate transaction rejected by dedup migration'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Mark duplicate approved deposits as REJECTED.
WITH ranked_dep AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY lower(transaction_id)
            ORDER BY
                CASE status WHEN 'APPROVED' THEN 1 ELSE 2 END ASC,
                id DESC
        ) AS rn
    FROM deposit_requests
    WHERE transaction_id IS NOT NULL
      AND transaction_id <> ''
      AND status IN ('PENDING', 'APPROVED')
)
UPDATE deposit_requests
SET status = 'REJECTED'
WHERE id IN (SELECT id FROM ranked_dep WHERE rn > 1);

-- Step 3: Now that duplicates are resolved, create the unique indices.
CREATE UNIQUE INDEX IF NOT EXISTS orders_transaction_id_approved_unique
    ON orders (lower(transaction_id))
    WHERE transaction_id IS NOT NULL
      AND transaction_id <> ''
      AND status IN ('PENDING', 'APPROVED', 'COMPLETED');

CREATE UNIQUE INDEX IF NOT EXISTS deposit_requests_transaction_id_approved_unique
    ON deposit_requests (lower(transaction_id))
    WHERE transaction_id IS NOT NULL
      AND transaction_id <> ''
      AND status IN ('PENDING', 'APPROVED');
