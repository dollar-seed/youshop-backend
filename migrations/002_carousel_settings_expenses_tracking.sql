-- You Shop — migration 002
-- Adds: carousel slides, site settings (commission rate override, promo video),
-- expenses, and per-item order tracking status.

CREATE TYPE item_status AS ENUM ('placed', 'processing', 'shipped', 'delivered', 'cancelled');

ALTER TABLE order_items ADD COLUMN status item_status NOT NULL DEFAULT 'placed';
ALTER TABLE order_items ADD COLUMN status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE carousel_slides (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline         TEXT NOT NULL,
  subtext          TEXT NOT NULL DEFAULT '',
  image            TEXT,
  image_mobile     TEXT,
  hide_text        BOOLEAN NOT NULL DEFAULT false,
  desktop_position TEXT,
  mobile_position  TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'General',
  amount      NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
