const { pool } = require("../lib/db");

async function listExpenses(req, res) {
  const result = await pool.query("SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC");
  res.json(result.rows);
}

async function createExpense(req, res) {
  const { description, category, amount, date } = req.body;
  if (!description || amount == null) return res.status(400).json({ error: "Description and amount are required." });
  const result = await pool.query(
    `INSERT INTO expenses (description, category, amount, expense_date)
     VALUES ($1,$2,$3, COALESCE($4, CURRENT_DATE)) RETURNING *`,
    [description, category || "General", amount, date || null]
  );
  res.status(201).json(result.rows[0]);
}

async function deleteExpense(req, res) {
  await pool.query("DELETE FROM expenses WHERE id = $1", [req.params.id]);
  res.status(204).end();
}

module.exports = { listExpenses, createExpense, deleteExpense };
