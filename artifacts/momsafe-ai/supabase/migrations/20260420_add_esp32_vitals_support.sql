-- Adds support for ESP32-originated vitals and activity tracking.

alter table public.vitals
  add column if not exists steps integer,
  add column if not exists source text not null default 'manual',
  add column if not exists device_id text,
  add column if not exists firmware_version text,
  add column if not exists sequence_id bigint,
  add column if not exists ingested_at timestamptz not null default now();

alter table public.vitals
  drop constraint if exists vitals_source_check;

alter table public.vitals
  add constraint vitals_source_check
  check (source in ('manual', 'esp32'));

alter table public.vitals
  drop constraint if exists vitals_steps_check;

alter table public.vitals
  add constraint vitals_steps_check
  check (steps is null or steps >= 0);

create unique index if not exists vitals_esp32_device_sequence_unique
  on public.vitals (device_id, sequence_id)
  where source = 'esp32' and device_id is not null and sequence_id is not null;

create index if not exists vitals_user_recorded_at_idx
  on public.vitals (user_id, recorded_at desc);
