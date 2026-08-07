const { pool } = require("../lib/db");

async function listSlides(req, res) {
  const result = await pool.query("SELECT * FROM carousel_slides ORDER BY sort_order ASC, created_at ASC");
  res.json(result.rows);
}

async function createSlide(req, res) {
  const { headline, subtext, image, imageMobile, hideText, desktopPosition, mobilePosition } = req.body;
  if (!headline) return res.status(400).json({ error: "Headline is required." });
  const maxOrder = await pool.query("SELECT COALESCE(MAX(sort_order), -1) AS m FROM carousel_slides");
  const result = await pool.query(
    `INSERT INTO carousel_slides (headline, subtext, image, image_mobile, hide_text, desktop_position, mobile_position, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [headline, subtext || "", image || null, imageMobile || null, !!hideText, desktopPosition || null, mobilePosition || null, maxOrder.rows[0].m + 1]
  );
  res.status(201).json(result.rows[0]);
}

async function updateSlide(req, res) {
  const { headline, subtext, image, imageMobile, hideText, desktopPosition, mobilePosition } = req.body;
  const result = await pool.query(
    `UPDATE carousel_slides SET
       headline = COALESCE($1, headline), subtext = COALESCE($2, subtext),
       image = COALESCE($3, image), image_mobile = COALESCE($4, image_mobile),
       hide_text = COALESCE($5, hide_text), desktop_position = COALESCE($6, desktop_position),
       mobile_position = COALESCE($7, mobile_position)
     WHERE id = $8 RETURNING *`,
    [headline, subtext, image, imageMobile, hideText, desktopPosition, mobilePosition, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Slide not found." });
  res.json(result.rows[0]);
}

async function deleteSlide(req, res) {
  await pool.query("DELETE FROM carousel_slides WHERE id = $1", [req.params.id]);
  res.status(204).end();
}

// Simple drag-reorder support: client sends the full ordered list of slide IDs.
async function reorderSlides(req, res) {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds must be an array." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query("UPDATE carousel_slides SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
    }
    await client.query("COMMIT");
    res.status(204).end();
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Could not reorder slides." });
  } finally {
    client.release();
  }
}

module.exports = { listSlides, createSlide, updateSlide, deleteSlide, reorderSlides };
