ALTER TABLE orders ADD COLUMN created_by TEXT;
CREATE TABLE IF NOT EXISTS order_tenders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('cash', 'card')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_tenders_order ON order_tenders(order_id);
