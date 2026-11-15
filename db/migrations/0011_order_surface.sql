ALTER TABLE orders ADD COLUMN order_surface TEXT NOT NULL DEFAULT 'pickup';
CREATE INDEX IF NOT EXISTS orders_surface_branch ON orders(branch_id, order_surface);
