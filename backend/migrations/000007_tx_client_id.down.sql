DROP INDEX IF EXISTS uq_transactions_client_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS client_id;
