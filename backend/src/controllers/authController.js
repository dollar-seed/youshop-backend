const bcrypt = require("bcryptjs");
const { pool } = require("../lib/db");
const { signToken } = require("../middleware/auth");

const PHONE_RE = /^[0-9+ ]{7,15}$/;

async function register(req, res) {
  const { name, email, phone, password, role, businessName } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ error: "Name, phone, and password are required." });
  }
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  const wantsRole = role === "seller" ? "seller" : "buyer"; // admin accounts are seeded, never self-registered

  const existing = await pool.query(
    "SELECT id FROM users WHERE phone = $1 OR (email IS NOT NULL AND email = $2)",
    [phone, email || null]
  );
  if (existing.rows.length) {
    return res.status(409).json({ error: "An account with this phone or email already exists." });
  }
  if (wantsRole === "seller" && !businessName) {
    return res.status(400).json({ error: "Business name is required to register as a seller." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, role, created_at`,
      [name, email || null, phone, passwordHash, wantsRole]
    );
    const user = userResult.rows[0];

    let sellerProfile = null;
    if (wantsRole === "seller") {
      const sellerResult = await client.query(
        `INSERT INTO seller_profiles (user_id, business_name, status)
         VALUES ($1, $2, 'pending') RETURNING id, business_name, status`,
        [user.id, businessName]
      );
      sellerProfile = sellerResult.rows[0];
    }
    await client.query("COMMIT");

    const token = signToken(user);
    res.status(201).json({ token, user, sellerProfile });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Registration failed. Please try again." });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  const { identifier, password } = req.body; // identifier = email or phone
  if (!identifier || !password) {
    return res.status(400).json({ error: "Enter your email/phone and password." });
  }
  const result = await pool.query(
    "SELECT * FROM users WHERE phone = $1 OR email = $1",
    [identifier.trim()]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "No account found with those details." });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  let sellerProfile = null;
  if (user.role === "seller") {
    const sp = await pool.query("SELECT id, business_name, status FROM seller_profiles WHERE user_id = $1", [user.id]);
    sellerProfile = sp.rows[0] || null;
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, created_at: user.created_at },
    sellerProfile,
  });
}

async function me(req, res) {
  const result = await pool.query(
    "SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1",
    [req.user.sub]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found." });

  let sellerProfile = null;
  if (user.role === "seller") {
    const sp = await pool.query("SELECT id, business_name, status FROM seller_profiles WHERE user_id = $1", [user.id]);
    sellerProfile = sp.rows[0] || null;
  }
  res.json({ user, sellerProfile });
}

module.exports = { register, login, me };
