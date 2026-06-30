ALTER TABLE transaction_items
    DROP COLUMN IF EXISTS variant_id,
    DROP COLUMN IF EXISTS line_no;
