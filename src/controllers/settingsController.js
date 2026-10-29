const { pool } = require("../lib/db");

const DEFAULTS = {
  videoUrl: "https://www.youtube.com/embed/9d2JkvbtY_4",
  commissionRate: String(process.env.COMMISSION_RATE || 10),
  heroHeadline: "",
  heroSubtext: "",
};

async function getSettings(req, res) {
  const result = await pool.query("SELECT key, value FROM site_settings");
  const settings = { ...DEFAULTS };
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
}

async function updateSettings(req, res) {
  const allowedKeys = ["videoUrl", "commissionRate", "heroHeadline", "heroSubtext"];
  const entries = Object.entries(req.body).filter(([k]) => allowedKeys.includes(k));
  if (!entries.length) return res.status(400).json({ error: "No valid settings provided." });

  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, String(value)]
    );
  }
  const result = await pool.query("SELECT key, value FROM site_settings");
  const settings = { ...DEFAULTS };
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
}

module.exports = { getSettings, updateSettings };
