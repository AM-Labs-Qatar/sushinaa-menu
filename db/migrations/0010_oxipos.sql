ALTER TABLE orders ADD COLUMN pos_export_id INTEGER;
ALTER TABLE orders ADD COLUMN accepted_by_pos_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_pos_export_id ON orders(pos_export_id);
CREATE INDEX IF NOT EXISTS orders_pos_pending ON orders(branch_id, accepted_by_pos_at);
