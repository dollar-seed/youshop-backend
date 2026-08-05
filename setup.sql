-- ============================================================
-- You Shop — one-time database setup
-- Paste this whole file into your hosting provider's database
-- query console (Railway: your Postgres service → "Data" tab →
-- Query. Render: the "Shell" or "psql" connect option they give
-- you). Safe to run once against a fresh, empty database.
-- ============================================================

-- ---------- 1. Schema ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE role AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE seller_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'fulfilled', 'cancelled');
CREATE TYPE payment_method AS ENUM ('mpesa', 'bank_transfer');

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT UNIQUE,
  phone          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           role NOT NULL DEFAULT 'buyer',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE seller_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name  TEXT NOT NULL,
  status         seller_status NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seller_profiles_status ON seller_profiles(status);

CREATE TABLE categories (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category_id     UUID NOT NULL REFERENCES categories(id),
  seller_id       UUID REFERENCES seller_profiles(id),
  price           NUMERIC(12,2) NOT NULL,
  original_price  NUMERIC(12,2),
  cost            NUMERIC(12,2) NOT NULL,
  stock           INTEGER NOT NULL DEFAULT 0,
  image           TEXT,
  features        TEXT[] NOT NULL DEFAULT '{}',
  description     TEXT NOT NULL DEFAULT '',
  rating          NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  reviews         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_seller ON products(seller_id);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref       TEXT NOT NULL UNIQUE,
  buyer_id        UUID REFERENCES users(id),
  buyer_name      TEXT NOT NULL,
  buyer_phone     TEXT NOT NULL,
  buyer_address   TEXT NOT NULL,
  payment_method  payment_method NOT NULL,
  status          order_status NOT NULL DEFAULT 'pending_payment',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id),
  product_name       TEXT NOT NULL,
  seller_id          UUID,
  qty                INTEGER NOT NULL,
  unit_price         NUMERIC(12,2) NOT NULL,
  unit_cost          NUMERIC(12,2) NOT NULL,
  commission_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission         NUMERIC(12,2) NOT NULL DEFAULT 0,
  seller_payout      NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_earnings  NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);

-- ---------- 2. Seed data ----------

-- Admin login: phone 0700000000, password changeme123
-- ⚠️ Sign in and this is the first thing you should change.
INSERT INTO users (name, phone, password_hash, role)
VALUES ('You Shop Admin', '0700000000', crypt('changeme123', gen_salt('bf')), 'admin');

INSERT INTO categories (name) VALUES
  ('Fashion'), ('Home'), ('Electronics'), ('Beauty'), ('Kids');

INSERT INTO products (name, category_id, price, original_price, cost, stock, features, description)
SELECT 'Woven Tote Bag', id, 1200, 1600, 700, 24, ARRAY['Durable woven fabric','Reinforced handles'], ''
FROM categories WHERE name = 'Fashion';

INSERT INTO products (name, category_id, price, cost, stock, features, description)
SELECT 'Ceramic Mug Set', id, 950, 500, 40, ARRAY['Set of 2 mugs','Dishwasher safe'], ''
FROM categories WHERE name = 'Home';

INSERT INTO products (name, category_id, price, original_price, cost, stock, features, description)
SELECT 'Wireless Earbuds', id, 2800, 3800, 1600, 15, ARRAY['6-hr playtime + case','3 ear-tip sizes'], ''
FROM categories WHERE name = 'Electronics';

INSERT INTO products (name, category_id, price, cost, stock, features, description)
SELECT 'Shea Body Butter', id, 650, 300, 60, ARRAY['100% natural shea','Deep moisture'], ''
FROM categories WHERE name = 'Beauty';

INSERT INTO products (name, category_id, price, original_price, cost, stock, features, description)
SELECT 'Kids Puzzle Toy', id, 800, 1000, 400, 12, ARRAY['24-piece wooden set','Non-toxic paint'], ''
FROM categories WHERE name = 'Kids';

-- Done. You should now have 5 categories and 5 sample products, plus one admin login.
