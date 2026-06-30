ALTER TABLE transactions DROP COLUMN IF EXISTS promo_discount;
DROP TABLE IF EXISTS promotions;
DROP TYPE IF EXISTS promo_type;
