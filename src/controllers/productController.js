const { pool } = require("../lib/db");

async function listCategories(req, res) {
  const result = await pool.query("SELECT * FROM categories ORDER BY name ASC");
  res.json(result.rows);
}

async function createCategory(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Category name is required." });
  try {
    const result = await pool.query(
      "INSERT INTO categories (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "That category already exists." });
    console.error(e);
    res.status(500).json({ error: "Could not create category." });
  }
}

async function deleteCategory(req, res) {
  await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  res.status(204).end();
}

async function listProducts(req, res) {
  const { categoryId, sellerId, search } = req.query;
  const clauses = [];
  const params = [];
  if (categoryId) { params.push(categoryId); clauses.push(`p.category_id = $${params.length}`); }
  if (sellerId) { params.push(sellerId); clauses.push(`p.seller_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); clauses.push(`p.name ILIKE $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, sp.business_name AS seller_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN seller_profiles sp ON sp.id = p.seller_id
     ${where}
     ORDER BY p.created_at DESC`,
    params
  );
  res.json(result.rows);
}

async function getProduct(req, res) {
  const result = await pool.query(
    `SELECT p.*, c.name AS category_name, sp.business_name AS seller_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN seller_profiles sp ON sp.id = p.seller_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Product not found." });
  res.json(result.rows[0]);
}

// Sellers may only create/edit their own products (and must be approved); admin can do anything.
async function createProduct(req, res) {
  const { name, categoryId, price, originalPrice, cost, stock, image, features, description } = req.body;
  if (!name || !categoryId || price == null || cost == null) {
    return res.status(400).json({ error: "Name, category, price, and cost are required." });
  }

  let sellerId = null;
  if (req.user.role === "seller") {
    const sp = await pool.query("SELECT id, status FROM seller_profiles WHERE user_id = $1", [req.user.sub]);
    if (!sp.rows[0] || sp.rows[0].status !== "approved") {
      return res.status(403).json({ error: "Your seller account must be approved before you can list products." });
    }
    sellerId = sp.rows[0].id;
  }
  // admin can optionally assign a sellerId via body to create on a seller's behalf; otherwise null = direct listing
  if (req.user.role === "admin" && req.body.sellerId) sellerId = req.body.sellerId;

  const result = await pool.query(
    `INSERT INTO products (name, category_id, seller_id, price, original_price, cost, stock, image, features, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [name, categoryId, sellerId, price, originalPrice || null, cost, stock || 0, image || null, features || [], description || ""]
  );
  res.status(201).json(result.rows[0]);
}

async function updateProduct(req, res) {
  const existing = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Product not found." });

  if (req.user.role === "seller") {
    const sp = await pool.query("SELECT id FROM seller_profiles WHERE user_id = $1", [req.user.sub]);
    if (!sp.rows[0] || sp.rows[0].id !== existing.rows[0].seller_id) {
      return res.status(403).json({ error: "You can only edit your own products." });
    }
  }

  const fields = ["name", "categoryId", "price", "originalPrice", "cost", "stock", "image", "features", "description"];
  const columnMap = { categoryId: "category_id", originalPrice: "original_price" };
  const sets = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      sets.push(`${columnMap[f] || f} = $${params.length}`);
    }
  }
  if (!sets.length) return res.json(existing.rows[0]);
  sets.push(`updated_at = now()`);
  params.push(req.params.id);

  const result = await pool.query(
    `UPDATE products SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  res.json(result.rows[0]);
}

async function deleteProduct(req, res) {
  const existing = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Product not found." });

  if (req.user.role === "seller") {
    const sp = await pool.query("SELECT id FROM seller_profiles WHERE user_id = $1", [req.user.sub]);
    if (!sp.rows[0] || sp.rows[0].id !== existing.rows[0].seller_id) {
      return res.status(403).json({ error: "You can only delete your own products." });
    }
  }
  await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  res.status(204).end();
}

module.exports = {
  listCategories, createCategory, deleteCategory,
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
};
