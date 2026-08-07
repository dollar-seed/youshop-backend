const { pool } = require("../lib/db");

async function listVideos(req, res) {
  const result = await pool.query("SELECT * FROM promo_videos ORDER BY sort_order ASC, created_at ASC");
  res.json(result.rows);
}

function extractYouTubeId(url) {
  const patterns = [/youtu\.be\/([^?&]+)/, /v=([^?&]+)/, /embed\/([^?&]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

async function createVideo(req, res) {
  const { title, url } = req.body;
  if (!url) return res.status(400).json({ error: "A video URL is required." });
  const vid = extractYouTubeId(url);
  if (!vid) return res.status(400).json({ error: "That doesn't look like a valid YouTube link." });
  const embedUrl = `https://www.youtube.com/embed/${vid}`;
  const maxOrder = await pool.query("SELECT COALESCE(MAX(sort_order), -1) AS m FROM promo_videos");
  const result = await pool.query(
    "INSERT INTO promo_videos (title, url, sort_order) VALUES ($1,$2,$3) RETURNING *",
    [title || "Promo Video", embedUrl, maxOrder.rows[0].m + 1]
  );
  res.status(201).json(result.rows[0]);
}

async function updateVideo(req, res) {
  const { title, url } = req.body;
  let embedUrl;
  if (url) {
    const vid = extractYouTubeId(url);
    if (!vid) return res.status(400).json({ error: "That doesn't look like a valid YouTube link." });
    embedUrl = `https://www.youtube.com/embed/${vid}`;
  }
  const result = await pool.query(
    "UPDATE promo_videos SET title = COALESCE($1, title), url = COALESCE($2, url) WHERE id = $3 RETURNING *",
    [title, embedUrl, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Video not found." });
  res.json(result.rows[0]);
}

async function deleteVideo(req, res) {
  await pool.query("DELETE FROM promo_videos WHERE id = $1", [req.params.id]);
  res.status(204).end();
}

module.exports = { listVideos, createVideo, updateVideo, deleteVideo };
