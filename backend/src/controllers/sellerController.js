const { pool } = require("../lib/db");

async function listSellers(req, res) {
  const { status } = req.query;
  const params = [];
  let where = "";
  if (status) { params.push(status); where = "WHERE sp.status = $1"; }
  const result = await pool.query(
    `SELECT sp.*, u.name AS owner_name, u.phone, u.email
     FROM seller_profiles sp JOIN users u ON u.id = sp.user_id
     ${where} ORDER BY sp.created_at DESC`,
    params
  );
  res.json(result.rows);
}

async function updateSellerStatus(req, res) {
  const { status } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const result = await pool.query(
    "UPDATE seller_profiles SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Seller not found." });
  res.json(result.rows[0]);
}

module.exports = { listSellers, updateSellerStatus };
