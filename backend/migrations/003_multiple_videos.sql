-- You Shop — migration 003
-- Replaces the single video-URL setting with a proper list of promo videos.

CREATE TABLE promo_videos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Carry over the old single videoUrl setting (if any) as the first video, so nothing is lost.
INSERT INTO promo_videos (title, url, sort_order)
SELECT 'Promo Video', value, 0 FROM site_settings WHERE key = 'videoUrl' AND value IS NOT NULL AND value != '';
