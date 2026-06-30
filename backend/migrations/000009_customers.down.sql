ALTER TABLE transactions
    DROP COLUMN IF EXISTS points_earned,
    DROP COLUMN IF EXISTS customer_id;

DROP TABLE IF EXISTS loyalty_points;
DROP TYPE IF EXISTS loyalty_type;
DROP TABLE IF EXISTS customers;
