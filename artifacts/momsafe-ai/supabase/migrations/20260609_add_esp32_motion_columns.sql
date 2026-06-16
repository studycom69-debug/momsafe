-- Store MPU6050 accelerometer samples from ESP32 vitals payloads.

alter table public.vitals
  add column if not exists motion_x double precision,
  add column if not exists motion_y double precision,
  add column if not exists motion_z double precision;
