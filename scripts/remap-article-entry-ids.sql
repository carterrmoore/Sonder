-- Article entry_ids re-mapping script
-- Run AFTER: pipeline re-run complete + curator review pass (new entries are 'approved')
-- Run BEFORE: seed entry deletion
-- Purpose: update article entry_ids arrays to reference new entry UUIDs by name match
--
-- Kraków city_id: 21b778e8-0b37-4adc-ae10-5a226929c59c

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Preview (run this first — review ALL rows before proceeding)
-- Look for any 'NO MATCH' rows and handle manually before running Step 2.
-- ─────────────────────────────────────────────────────────────────────────────
WITH article_entries AS (
  SELECT
    a.id AS article_id,
    a.slug,
    a.title,
    unnest(a.entry_ids) AS old_entry_id
  FROM articles a
  WHERE a.city_id = '21b778e8-0b37-4adc-ae10-5a226929c59c'
),
old_entries AS (
  SELECT id, name FROM entries WHERE id IN (SELECT old_entry_id FROM article_entries)
),
new_entries AS (
  SELECT id, name FROM entries
  WHERE city_id = '21b778e8-0b37-4adc-ae10-5a226929c59c'
    AND review_status = 'approved'
    AND raw_pipeline_data->>'nomination_note' IS DISTINCT FROM 'SEED_DATA_DELETE_AFTER_PIPELINE_RERUN'
)
SELECT
  ae.article_id,
  ae.slug,
  ae.old_entry_id,
  oe.name AS old_name,
  ne.id AS new_entry_id,
  CASE WHEN ne.id IS NULL THEN 'NO MATCH - needs manual review' ELSE 'OK' END AS status
FROM article_entries ae
LEFT JOIN old_entries oe ON oe.id = ae.old_entry_id
LEFT JOIN new_entries ne ON lower(trim(ne.name)) = lower(trim(oe.name))
ORDER BY ae.slug, oe.name;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Apply the remapping
-- Run ONLY after reviewing Step 1 output and confirming all rows are 'OK'.
-- Any remaining 'NO MATCH' rows will retain their old (stale) UUID — fix manually.
-- ─────────────────────────────────────────────────────────────────────────────
WITH old_entry_names AS (
  SELECT id, name
  FROM entries
  WHERE id IN (
    SELECT unnest(entry_ids) FROM articles
    WHERE city_id = '21b778e8-0b37-4adc-ae10-5a226929c59c'
  )
),
new_entries AS (
  SELECT id, name FROM entries
  WHERE city_id = '21b778e8-0b37-4adc-ae10-5a226929c59c'
    AND review_status = 'approved'
    AND raw_pipeline_data->>'nomination_note' IS DISTINCT FROM 'SEED_DATA_DELETE_AFTER_PIPELINE_RERUN'
),
name_map AS (
  SELECT oe.id AS old_id, ne.id AS new_id
  FROM old_entry_names oe
  JOIN new_entries ne ON lower(trim(ne.name)) = lower(trim(oe.name))
),
remapped AS (
  SELECT
    a.id AS article_id,
    array_agg(COALESCE(nm.new_id, old_id_val) ORDER BY ordinality) AS new_ids
  FROM articles a
  CROSS JOIN LATERAL unnest(a.entry_ids) WITH ORDINALITY AS t(old_id_val, ordinality)
  LEFT JOIN name_map nm ON nm.old_id = t.old_id_val
  WHERE a.city_id = '21b778e8-0b37-4adc-ae10-5a226929c59c'
  GROUP BY a.id
)
UPDATE articles
SET
  entry_ids = remapped.new_ids,
  updated_at = now()
FROM remapped
WHERE articles.id = remapped.article_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Delete seed entries
-- Run ONLY after Step 2 is complete and verified.
-- ─────────────────────────────────────────────────────────────────────────────
-- DELETE FROM entries
-- WHERE raw_pipeline_data->>'nomination_note' = 'SEED_DATA_DELETE_AFTER_PIPELINE_RERUN';
