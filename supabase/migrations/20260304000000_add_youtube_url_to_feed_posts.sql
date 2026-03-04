-- Add youtube_url column to feed_posts table
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS youtube_url TEXT DEFAULT NULL;
