process.env.DOTENV_CONFIG_QUIET = 'true';
// Seeds an admin account, default categories, and a few sample products.
// Run with: node scripts/seed.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("../src/lib/db");

const CATEGORIES = ["Fashion", "Home", "Electronics", "Beauty", "Kids"];

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE || "0700000000";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existingAdmin = await pool.query("SELECT id FROM users WHERE phone = $1", [adminPhone]);
  if (!existingAdmin.rows[0]) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      "INSERT INTO users (name, phone, password_hash, role) VALUES ($1,$2,$3,'admin')",
      ["You Shop Admin", adminPhone, hash]
    );
    console.log(`✓ Admin account created — phone: ${adminPhone}, password: ${adminPassword}`);
    console.log("  ⚠️  Change this password immediately in production.");
  } else {
    console.log("✓ Admin account already exists, skipping.");
  }

  const categoryIds = {};
  for (const name of CATEGORIES) {
    const existing = await pool.query("SELECT id FROM categories WHERE name = $1", [name]);
    if (existing.rows[0]) {
      categoryIds[name] = existing.rows[0].id;
    } else {
      const result = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING id", [name]);
      categoryIds[name] = result.rows[0].id;
    }
  }
  console.log(`✓ Categories ready: ${CATEGORIES.join(", ")}`);

  const sampleProducts = [
    { name: "Woven Tote Bag", cat: "Fashion", price: 1200, originalPrice: 1600, cost: 700, stock: 24, features: ["Durable woven fabric", "Reinforced handles"] },
    { name: "Ceramic Mug Set", cat: "Home", price: 950, cost: 500, stock: 40, features: ["Set of 2 mugs", "Dishwasher safe"] },
    { name: "Wireless Earbuds", cat: "Electronics", price: 2800, originalPrice: 3800, cost: 1600, stock: 15, features: ["6-hr playtime + case", "3 ear-tip sizes"] },
    { name: "Shea Body Butter", cat: "Beauty", price: 650, cost: 300, stock: 60, features: ["100% natural shea", "Deep moisture"] },
    { name: "Kids Puzzle Toy", cat: "Kids", price: 800, originalPrice: 1000, cost: 400, stock: 0, features: ["24-piece wooden set", "Non-toxic paint"] },
  ];

  for (const p of sampleProducts) {
    const existing = await pool.query("SELECT id FROM products WHERE name = $1", [p.name]);
    if (existing.rows[0]) continue;
    await pool.query(
      `INSERT INTO products (name, category_id, price, original_price, cost, stock, features, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.name, categoryIds[p.cat], p.price, p.originalPrice || null, p.cost, p.stock, p.features, ""]
    );
  }
  console.log(`✓ Sample products seeded.`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
