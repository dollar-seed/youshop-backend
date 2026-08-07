# You Shop API

A real, working backend for the You Shop marketplace — buyer/seller/admin auth (bcrypt +
JWT), product catalog, seller approval workflow, and checkout with server-side commission
calculation. Built to pair with the You Shop storefront HTML file.

**Scope of this MVP:** auth, products/categories, sellers, orders. Carousel management and
the admin Finance page (commission-rate editing, expense tracking, P&L) are **not** covered
yet — those still live only in the frontend prototype for now.

**Payments:** orders are recorded as `pending_payment`. Real M-Pesa (Daraja STK Push) isn't
wired up yet — that's a clean next step whenever you're ready for it.

---

## 1. Local setup

You need Node 18+ and a PostgreSQL database. Easiest path is Docker:

```bash
docker compose up -d          # starts Postgres on localhost:5432
cp .env.example .env          # defaults already match docker-compose
npm install
psql "$DATABASE_URL" -f migrations/001_init.sql   # creates tables
node scripts/seed.js          # creates an admin account + sample data
node src/server.js            # starts the API on http://localhost:4000
```

No Docker? Point `DATABASE_URL` in `.env` at any Postgres instance you have (a free one on
[Supabase](https://supabase.com) or [Railway](https://railway.app) works fine), then run the
same `psql` migration + seed + start steps above.

The seed script prints the admin login it creates — **change that password immediately** if
this ever touches real customer data.

## 2. Verify it's working

```bash
curl http://localhost:4000/health
# {"ok":true}
```

There's also a full end-to-end test script (registers a seller, gets admin approval, lists a
product, checks out, and verifies the commission math, stock decrement, overselling
protection, and price-tampering protection all work correctly):

```bash
node src/server.js &          # in one terminal
node scripts/e2e-test.js      # in another
```

## 3. API reference

All request/response bodies are JSON. Authenticated routes expect
`Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{name, phone, password, email?, role?, businessName?}`. `role: "seller"` requires `businessName` and creates a seller profile with `status: "pending"`. |
| POST | `/auth/login` | — | `{identifier, password}` — identifier is email or phone. |
| GET | `/auth/me` | any | Returns the current user + seller profile if applicable. |

### Products & categories
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/products/categories` | — | |
| POST | `/products/categories` | admin | |
| DELETE | `/products/categories/:id` | admin | |
| GET | `/products` | — | Query params: `categoryId`, `sellerId`, `search`. |
| GET | `/products/:id` | — | |
| POST | `/products` | admin, seller | Sellers must be `approved`; product is auto-tagged with their `sellerId`. Admin may pass `sellerId` explicitly, or omit it for a direct You Shop listing. |
| PUT | `/products/:id` | admin, seller (owner only) | |
| DELETE | `/products/:id` | admin, seller (owner only) | |

### Sellers (admin approval workflow)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/sellers?status=pending` | admin | `status` filter is optional. |
| PUT | `/sellers/:id/status` | admin | `{status: "approved" \| "rejected" \| "pending"}` |

### Orders
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/orders` | optional | `{items: [{productId, qty}], buyerName, buyerPhone, buyerAddress, paymentMethod}`. Works for guests (no token) or logged-in buyers (order is linked to their account). Price, cost, and stock are always re-read from the database server-side — client-submitted prices are ignored, and orders are rejected if stock is insufficient. |
| GET | `/orders/mine` | buyer | Full order history for the logged-in buyer. |
| GET | `/orders` | admin, seller | Admin sees every order. Sellers see only their own order line items (never other sellers' or direct-listing sales). |

## 4. Deploying

Railway and Render both work well for this:

1. Push this `backend/` folder to its own GitHub repo (or a subfolder of your existing one).
2. Create a new Postgres database on the platform, and a new web service pointing at this repo.
3. Set environment variables from `.env.example` — **generate a real `JWT_SECRET`**
   (`openssl rand -base64 32`), and set `CORS_ORIGIN` to your actual frontend domain once you
   have one (using `"*"` is fine to get started, but tighten it before going live).
4. Run the migration once against the production database:
   `psql "$DATABASE_URL" -f migrations/001_init.sql`
5. Run `node scripts/seed.js` once (or set `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD` env vars
   first to avoid the default admin credentials).
6. Start command: `node src/server.js`.

## 5. Security notes for going further

- Passwords are hashed with bcrypt (cost factor 10) — never stored in plain text.
- JWTs expire after 30 days; there's no refresh-token flow yet, so a signed-out session just
  means the client discards the token (there's no server-side revocation list). Fine for an
  MVP, worth adding if this handles real money.
- All money-affecting logic (price, cost, stock, commission split) is computed server-side
  from the database inside a transaction — the API never trusts values submitted by the
  client for these fields.
- `CORS_ORIGIN="*"` is convenient for development but should be locked down to your real
  frontend domain(s) before this goes live.
