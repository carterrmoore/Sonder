-- Add Booking.com summary columns to entries table.
-- Full raw data lives in raw_pipeline_data.booking_com_data (JSONB).
-- These columns surface the most useful fields for curator UI and preference filtering.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS booking_com_hotel_id       integer,
  ADD COLUMN IF NOT EXISTS booking_com_url            text,
  ADD COLUMN IF NOT EXISTS booking_com_rating         numeric(3,1),
  ADD COLUMN IF NOT EXISTS booking_com_review_count   integer,
  ADD COLUMN IF NOT EXISTS booking_com_category_scores jsonb;

-- booking_com_category_scores shape:
-- [{ "title": "Staff", "score": 9.6 }, { "title": "Value for money", "score": 9.1 }, ...]

COMMENT ON COLUMN entries.booking_com_hotel_id IS
  'Booking.com numeric hotel ID. Permanent — used for Demand API migration path.';
COMMENT ON COLUMN entries.booking_com_url IS
  'Clean Booking.com property URL, query params stripped.';
COMMENT ON COLUMN entries.booking_com_rating IS
  'Overall Booking.com rating 1–10 scale.';
COMMENT ON COLUMN entries.booking_com_review_count IS
  'Total Booking.com review count at time of last pipeline run.';
COMMENT ON COLUMN entries.booking_com_category_scores IS
  'Booking.com category score breakdown (Staff, Cleanliness, Value for money, etc.).';
