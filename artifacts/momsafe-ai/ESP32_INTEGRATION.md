# ESP32 Wi-Fi Vitals Ingestion Contract

This document defines the HTTP contract for ESP32 -> MomSafe ingestion.

## Endpoint

- Method: `POST`
- URL: `https://<project-ref>.supabase.co/functions/v1/esp32-ingest`
- Headers:
  - `Authorization: Bearer <ESP32_INGEST_TOKEN>`
  - `Content-Type: application/json`

## Request Body

```json
{
  "device_id": "esp32-room-01",
  "user_id": "00000000-0000-0000-0000-000000000000",
  "body_temperature_c": 36.8,
  "steps": 1245,
  "recorded_at": "2026-04-20T09:55:00.000Z",
  "sequence_id": 120,
  "firmware_version": "1.0.0"
}
```

## Validation Rules

- `device_id`: required, 3-128 chars.
- `user_id`: required UUID.
- `body_temperature_c`: required, min 34, max 42.
- `steps`: required integer, min 0.
- `recorded_at`: optional ISO timestamp, defaults to server time if omitted.
- `sequence_id`: optional integer >= 0.
- `firmware_version`: optional string <= 64 chars.

## Security Model

- ESP32 requests are authenticated using a shared bearer token in `Authorization`.
- The ingestion function uses Supabase service-role key from environment and writes to DB server-side.
- ESP32 must never use public anon key or direct table writes.

## Response

- `201 Created`
```json
{
  "ok": true,
  "vitals_id": "<inserted-row-id>",
  "recorded_at": "2026-04-20T09:55:00.000Z"
}
```

- Validation/auth errors return JSON with `{ "error": "..." }`.

## Supabase Deployment

From `artifacts/momsafe-ai`:

1. Apply SQL migration in Supabase SQL editor:
   - `supabase/migrations/20260420_add_esp32_vitals_support.sql`
2. Set function secret:
   - `ESP32_INGEST_TOKEN=<strong-random-token>`
3. Deploy function:
   - `supabase functions deploy esp32-ingest --no-verify-jwt`

## Quick Smoke Test (curl)

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/esp32-ingest" \
  -H "Authorization: Bearer <ESP32_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id":"esp32-room-01",
    "user_id":"00000000-0000-0000-0000-000000000000",
    "body_temperature_c":37.7,
    "steps":1450,
    "sequence_id":1,
    "firmware_version":"1.0.0"
  }'
```
