import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type IngestPayload = {
  device_id?: string;
  user_id?: string;
  body_temperature_c?: number;
  steps?: number;
  heart_rate?: number;
  spo2?: number;
  motion_x?: number;
  motion_y?: number;
  motion_z?: number;
  recorded_at?: string;
  sequence_id?: number;
  firmware_version?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validatePayload(payload: IngestPayload) {
  if (!payload.device_id || payload.device_id.trim().length < 3 || payload.device_id.length > 128) {
    return "device_id must be between 3 and 128 characters.";
  }
  if (!payload.user_id || !isUuid(payload.user_id)) {
    return "user_id must be a valid UUID.";
  }
  if (typeof payload.body_temperature_c !== "number" || payload.body_temperature_c < 34 || payload.body_temperature_c > 42) {
    return "body_temperature_c must be a number between 34 and 42.";
  }
  if (!Number.isInteger(payload.steps) || (payload.steps ?? -1) < 0) {
    return "steps must be an integer greater than or equal to 0.";
  }
  if (payload.recorded_at && Number.isNaN(Date.parse(payload.recorded_at))) {
    return "recorded_at must be a valid ISO timestamp.";
  }
  if (payload.sequence_id !== undefined && (!Number.isInteger(payload.sequence_id) || payload.sequence_id < 0)) {
    return "sequence_id must be an integer greater than or equal to 0.";
  }
  if (payload.firmware_version && payload.firmware_version.length > 64) {
    return "firmware_version must be 64 characters or less.";
  }
  if (payload.heart_rate !== undefined) {
    if (!Number.isInteger(payload.heart_rate) || payload.heart_rate < 0 || payload.heart_rate > 220) {
      return "heart_rate must be an integer between 0 and 220.";
    }
  }
  if (payload.spo2 !== undefined) {
    if (!Number.isInteger(payload.spo2) || payload.spo2 < 0 || payload.spo2 > 100) {
      return "spo2 must be an integer between 0 and 100.";
    }
  }
  if (payload.motion_x !== undefined && typeof payload.motion_x !== "number") {
    return "motion_x must be a number.";
  }
  if (payload.motion_y !== undefined && typeof payload.motion_y !== "number") {
    return "motion_y must be a number.";
  }
  if (payload.motion_z !== undefined && typeof payload.motion_z !== "number") {
    return "motion_z must be a number.";
  }
  return null;
}

function vitalsAlerts(vitals: { temperature: number; heart_rate?: number | null; spo2?: number | null }) {
  const alerts: Array<{ title: string; description: string; severity: string; type: string }> = [];

  if (vitals.temperature >= 39) {
    alerts.push({
      title: "Immediate Temperature Alert",
      description: `Temperature is dangerously high at ${vitals.temperature}°C.`,
      severity: "immediate",
      type: "Vital:Temperature",
    });
  } else if (vitals.temperature >= 37.5) {
    alerts.push({
      title: "Monitor Temperature",
      description: `Temperature is elevated at ${vitals.temperature}°C.`,
      severity: "monitor",
      type: "Vital:Temperature",
    });
  }

  if (vitals.heart_rate && vitals.heart_rate >= 120) {
    alerts.push({
      title: "High Heart Rate",
      description: `Heart rate is elevated at ${vitals.heart_rate} bpm.`,
      severity: "monitor",
      type: "Vital:HeartRate",
    });
  }

  if (vitals.spo2 && vitals.spo2 > 0 && vitals.spo2 < 94) {
    alerts.push({
      title: "Low SpO2",
      description: `Oxygen saturation is low at ${vitals.spo2}%.`,
      severity: "monitor",
      type: "Vital:SpO2",
    });
  }

  return alerts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  const expectedToken = Deno.env.get("ESP32_INGEST_TOKEN");
  if (!expectedToken || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: IngestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const vitalsRow = {
    user_id: payload.user_id,
    temperature: payload.body_temperature_c,
    steps: payload.steps,
    heart_rate: payload.heart_rate && payload.heart_rate > 0 ? payload.heart_rate : null,
    spo2: payload.spo2 && payload.spo2 > 0 ? payload.spo2 : null,
    motion_x: payload.motion_x ?? null,
    motion_y: payload.motion_y ?? null,
    motion_z: payload.motion_z ?? null,
    source: "esp32",
    device_id: payload.device_id,
    sequence_id: payload.sequence_id ?? null,
    firmware_version: payload.firmware_version ?? null,
    recorded_at: payload.recorded_at ?? new Date().toISOString(),
    ingested_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("vitals")
    .insert([vitalsRow])
    .select("id, user_id, temperature, recorded_at")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return new Response(
      JSON.stringify({ error: duplicate ? "Duplicate sequence for this device." : error.message }),
      {
        status: duplicate ? 409 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const alerts = vitalsAlerts({
    temperature: Number(data.temperature),
    heart_rate: vitalsRow.heart_rate,
    spo2: vitalsRow.spo2,
  });
  if (alerts.length > 0) {
    await supabase.from("alerts").insert(
      alerts.map((a) => ({
        user_id: data.user_id,
        title: a.title,
        description: a.description,
        severity: a.severity,
        type: a.type,
        is_read: false,
      })),
    );
  }

  return new Response(JSON.stringify({ ok: true, vitals_id: data.id, recorded_at: data.recorded_at }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
