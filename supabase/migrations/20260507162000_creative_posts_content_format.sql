-- creative_posts: social content_format for Ops Calendar dual-mode (social dots / legend).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_content_format') THEN
    CREATE TYPE public.creative_content_format AS ENUM (
      'feed_post',
      'carousel',
      'reel',
      'story'
    );
  END IF;
END $$;

ALTER TABLE public.creative_posts
  ADD COLUMN IF NOT EXISTS content_format public.creative_content_format;

-- Backfill: carousel if >1 slide; reel if sole slide is video; else feed_post.
UPDATE public.creative_posts p
SET content_format = sub.inferred
FROM (
  SELECT
    ca.post_id,
    CASE
      WHEN COUNT(*) > 1 THEN 'carousel'::public.creative_content_format
      WHEN BOOL_OR(ca.type = 'video'::text) THEN 'reel'::public.creative_content_format
      ELSE 'feed_post'::public.creative_content_format
    END AS inferred
  FROM public.creative_assets ca
  WHERE ca.post_id IS NOT NULL
  GROUP BY ca.post_id
) AS sub
WHERE sub.post_id = p.id
  AND p.content_format IS NULL;

UPDATE public.creative_posts
SET content_format = 'feed_post'::public.creative_content_format
WHERE content_format IS NULL;

ALTER TABLE public.creative_posts
  ALTER COLUMN content_format SET DEFAULT 'feed_post'::public.creative_content_format;

ALTER TABLE public.creative_posts
  ALTER COLUMN content_format SET NOT NULL;
