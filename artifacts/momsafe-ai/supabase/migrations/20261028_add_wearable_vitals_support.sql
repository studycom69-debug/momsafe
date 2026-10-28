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

-- 6. Passwordless wearable user email lookup RPC
CREATE OR REPLACE FUNCTION public.lookup_wearable_user_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  RETURN v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_wearable_user_by_email(text) TO anon, authenticated, service_role;

-- 7. Unique constraints for conflict resolution
ALTER TABLE public.vitals 
  DROP CONSTRAINT IF EXISTS vitals_user_device_record_key;
ALTER TABLE public.vitals 
  ADD CONSTRAINT vitals_user_device_record_key 
  UNIQUE (user_id, device_id, device_record_id);

ALTER TABLE public.sleep_data 
  DROP CONSTRAINT IF EXISTS sleep_data_user_device_record_key;
ALTER TABLE public.sleep_data 
  ADD CONSTRAINT sleep_data_user_device_record_key 
  UNIQUE (user_id, device_id, device_record_id);

-- 8. Atomic wearable records sync RPC function
CREATE OR REPLACE FUNCTION public.sync_wearable_records(
  p_user_id uuid,
  p_vitals jsonb DEFAULT '[]'::jsonb,
  p_sleep jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_vitals_count int := 0;
  v_sleep_count int := 0;
  v_item jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_vitals IS NOT NULL AND jsonb_array_length(p_vitals) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_vitals)
    LOOP
      INSERT INTO public.vitals (
        user_id, source, device_id, firmware_version, device_record_id, recorded_at, ingested_at,
        heart_rate, spo2, hrv, stress, systolic_bp, diastolic_bp, temperature, skin_temperature
      ) VALUES (
        p_user_id,
        COALESCE(v_item->>'source', 'wearable'),
        v_item->>'device_id',
        COALESCE(v_item->>'firmware_version', '2208A_v1.0'),
        v_item->>'device_record_id',
        (v_item->>'recorded_at')::timestamptz,
        now(),
        (v_item->>'heart_rate')::integer,
        (v_item->>'spo2')::integer,
        (v_item->>'hrv')::integer,
        (v_item->>'stress')::integer,
        (v_item->>'systolic_bp')::integer,
        (v_item->>'diastolic_bp')::integer,
        (v_item->>'temperature')::numeric,
        (v_item->>'skin_temperature')::numeric
      )
      ON CONFLICT (user_id, device_id, device_record_id)
      DO UPDATE SET
        heart_rate = COALESCE(EXCLUDED.heart_rate, vitals.heart_rate),
        spo2 = COALESCE(EXCLUDED.spo2, vitals.spo2),
        hrv = COALESCE(EXCLUDED.hrv, vitals.hrv),
        stress = COALESCE(EXCLUDED.stress, vitals.stress),
        systolic_bp = COALESCE(EXCLUDED.systolic_bp, vitals.systolic_bp),
        diastolic_bp = COALESCE(EXCLUDED.diastolic_bp, vitals.diastolic_bp),
        temperature = COALESCE(EXCLUDED.temperature, vitals.temperature),
        skin_temperature = COALESCE(EXCLUDED.skin_temperature, vitals.skin_temperature),
        ingested_at = now();

      v_vitals_count := v_vitals_count + 1;
    END LOOP;
  END IF;

  IF p_sleep IS NOT NULL AND jsonb_array_length(p_sleep) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_sleep)
    LOOP
      INSERT INTO public.sleep_data (
        user_id, source, device_id, device_record_id, sleep_hours, sleep_quality, recorded_at, date
      ) VALUES (
        p_user_id,
        COALESCE(v_item->>'source', 'wearable'),
        v_item->>'device_id',
        v_item->>'device_record_id',
        (v_item->>'sleep_hours')::numeric,
        COALESCE(v_item->>'sleep_quality', 'average'),
        (v_item->>'recorded_at')::timestamptz,
        COALESCE((v_item->>'recorded_at')::date, CURRENT_DATE)
      )
      ON CONFLICT (user_id, device_id, device_record_id)
      DO UPDATE SET
        sleep_hours = EXCLUDED.sleep_hours,
        sleep_quality = EXCLUDED.sleep_quality,
        recorded_at = EXCLUDED.recorded_at;

      v_sleep_count := v_sleep_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'vitals_uploaded', v_vitals_count,
    'sleep_uploaded', v_sleep_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_wearable_records(uuid, jsonb, jsonb) TO anon, authenticated, service_role;
