# Getting You Shop live — step by step

This assumes you have **nothing installed** on your computer. Everything below happens in
your web browser. Two free accounts needed: GitHub and Railway.

---

## Step 1 — Put the code on GitHub

Railway deploys code from GitHub, so the code needs a home there first.

1. Go to [github.com](https://github.com) and sign up (free) if you don't have an account.
2. Click the **+** icon top-right → **New repository**.
3. Name it `youshop-backend`, keep it Private or Public (either is fine), click **Create repository**.
4. On the next page, click **uploading an existing file**.
5. Open the `backend` folder you extracted, select **everything inside it** (all files and
   folders), and drag them into the browser window.
6. Scroll down, click **Commit changes**.

You now have the backend code sitting on GitHub.

## Step 2 — Create the database and the server on Railway

1. Go to [railway.app](https://railway.app) and sign up using your GitHub account (this
   makes Step 3 easier since they're already connected).
2. Click **New Project** → **Provision PostgreSQL**. Wait a few seconds — Railway builds you
   a real database automatically. Nothing to configure.
3. In that same project, click **+ New** → **GitHub Repo** → pick the `youshop-backend` repo
   you just created. Railway will start trying to deploy it — that's expected, it'll fail
   once (that's normal, keep going) because it needs a couple of settings first.

## Step 3 — Connect the two, and configure the server

1. Click on the **Postgres** box Railway created → tab **Variables** → find
   `DATABASE_URL` → copy it.
2. Click on your **backend service** box (the one from GitHub) → tab **Variables** → add:
   - `DATABASE_URL` → paste what you copied
   - `JWT_SECRET` → any long random text, e.g. mash your keyboard for 40 characters
   - `PORT` → `4000`
   - `COMMISSION_RATE` → `10`
   - `CORS_ORIGIN` → `*`
3. Still on the backend service, tab **Settings** → find **Start Command** → set it to:
   `node src/server.js`
4. It should redeploy automatically. Give it a minute, then check the **Deployments** tab —
   you want to see it running, not crashed. If it crashed, click into the deploy log and the
   error will usually point at a typo in one of the variables above.

## Step 4 — Set up the database tables and starter data

1. Click on the **Postgres** box again → tab **Data** (or **Query**, depending on Railway's
   current layout).
2. Open `setup.sql` (included in this backend folder) on your computer in any text editor,
   select all the text, copy it.
3. Paste it into Railway's query box and run it.
4. You should see a string of "success" messages and no red errors. This creates all the
   tables and adds 5 sample products plus one admin login:
   **phone `0700000000`, password `changeme123`** — sign in and change this once you're in.

## Step 5 — Get your live web address

1. On the backend service in Railway → tab **Settings** → **Networking** → click
   **Generate Domain**.
2. Railway gives you a real address, something like
   `https://youshop-backend-production.up.railway.app`. That's your live backend.
3. Test it: paste that address + `/health` into your browser
   (e.g. `https://youshop-backend-production.up.railway.app/health`). You should see
   `{"ok":true}`. If you see that, your backend is live on the internet.

## Step 6 — Point your storefront at it

1. Open `youshop_integrated_marketplace.html` in a text editor (Notepad, TextEdit, VS Code —
   anything works).
2. Find this line near the top of the `<script>` section:
   ```
   const API_BASE = window.YOUSHOP_API_BASE || "http://localhost:4000";
   ```
3. Just above it, add this line, using **your own** Railway address from Step 5:
   ```
   window.YOUSHOP_API_BASE = "https://youshop-backend-production.up.railway.app";
   ```
4. Save the file. Open it in your browser (double-click it) — it should now load real
   products from your live database, and sign-up/checkout will work for real.

---

## If something doesn't work

- **Storefront shows "Can't reach the store server"** → your Railway backend probably isn't
  running, or the address in Step 6 has a typo. Double-check the `/health` URL from Step 5
  works in a browser first.
- **Sign-in fails right after setup** → make sure Step 4's SQL actually ran without errors —
  if it partially failed, the admin account might not exist.
- Stuck on anything above — tell me exactly which step and what you're seeing, and I'll help
  you through it.
