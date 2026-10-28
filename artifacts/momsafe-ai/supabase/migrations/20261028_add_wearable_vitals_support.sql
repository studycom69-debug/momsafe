-- 20261028_add_wearable_vitals_support.sql
-- Adds support for J-Style 2208A and wearable BLE gateway vitals, HRV, stress, and sleep synchronization.

-- 1. Extend vitals source check to include wearable sources
ALTER TABLE public.vitals
  DROP CONSTRAINT IF EXISTS vitals_source_check;

ALTER TABLE public.vitals
  ADD CONSTRAINT vitals_source_check
  CHECK (source IN ('manual', 'esp32', 'wearable', 'jstyle_2208a'));

-- 2. Add wearable health metrics to vitals table
ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS hrv integer,
  ADD COLUMN IF NOT EXISTS stress integer,
  ADD COLUMN IF NOT EXISTS skin_temperature numeric,
  ADD COLUMN IF NOT EXISTS device_record_id text;

-- 3. Add check constraints for valid ranges
ALTER TABLE public.vitals
  DROP CONSTRAINT IF EXISTS vitals_hrv_check;

ALTER TABLE public.vitals
  ADD CONSTRAINT vitals_hrv_check
  CHECK (hrv IS NULL OR (hrv >= 1 AND hrv <= 300));

ALTER TABLE public.vitals
  DROP CONSTRAINT IF EXISTS vitals_stress_check;

ALTER TABLE public.vitals
  ADD CONSTRAINT vitals_stress_check
  CHECK (stress IS NULL OR (stress >= 0 AND stress <= 100));

-- 4. Unique deduplication index on device records
CREATE UNIQUE INDEX IF NOT EXISTS vitals_user_device_record_unique
  ON public.vitals (user_id, device_id, device_record_id)
  WHERE device_record_id IS NOT NULL;

-- 5. Extend sleep_data table for wearable sync
ALTER TABLE public.sleep_data
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_record_id text,
  ADD COLUMN IF NOT EXISTS deep_sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS light_sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS rem_sleep_hours numeric;

CREATE UNIQUE INDEX IF NOT EXISTS sleep_data_user_device_record_unique
  ON public.sleep_data (user_id, device_id, device_record_id)
  WHERE device_record_id IS NOT NULL;
