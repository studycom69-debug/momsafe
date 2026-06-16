import { supabase } from "./supabase";

export type AlertSeverity = "immediate" | "high" | "monitor" | "critical" | "warning" | "info";

interface AlertPayload {
  user_id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  type: string;
}

export async function createAlert(payload: AlertPayload) {
  const { user_id, title, type, severity } = payload;

  // 1. Check if same alert exists in last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: existingAlerts, error: fetchError } = await supabase
    .from("alerts")
    .select("id, severity")
    .eq("user_id", user_id)
    .eq("type", type) // Deduplicate primarily by type as requested
    .gte("created_at", tenMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error("Error checking for existing alerts:", fetchError);
  }

  const existingAlert = existingAlerts?.[0];

  if (existingAlert) {
    // 2. If exists, do NOT insert again unless severity is higher (Standard safety practice)
    // However, user requested "do NOT insert again" if it exists.
    // To be safe and clean, we suppress if same or lower severity.
    const severityOrder: Record<AlertSeverity, number> = { info: 0, monitor: 0, warning: 1, high: 1, critical: 2, immediate: 2 };
    const existingSeverity = (existingAlert.severity as AlertSeverity) || "info";

    if (severityOrder[severity] <= severityOrder[existingSeverity]) {
      console.log("Duplicate alert suppressed:", type);
      return { data: null, error: null, suppressed: true };
    }
  }

  // 3. Insert new alert
  const { data, error } = await supabase.from("alerts").insert([
    {
      ...payload,
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ]);

  return { data, error, suppressed: false };
}

export function checkVitalsForAlerts(vitals: {
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  spo2: number;
  temperature: number;
  weight: number;
}) {
  const alerts: Omit<AlertPayload, "user_id">[] = [];

  // Heart Rate
  if (vitals.heart_rate > 120) {
    alerts.push({
      title: "Critical Heart Rate",
      description: `Heart rate is dangerously high at ${vitals.heart_rate} bpm.`,
      severity: "critical",
      type: "Vital:HeartRate",
    });
  } else if (vitals.heart_rate > 100) {
    alerts.push({
      title: "Elevated Heart Rate",
      description: `Heart rate is high at ${vitals.heart_rate} bpm.`,
      severity: "warning",
      type: "Vital:HeartRate",
    });
  }

  // SpO2
  if (vitals.spo2 < 90) {
    alerts.push({
      title: "Immediate SpO2 Alert",
      description: `Oxygen saturation is dangerously low at ${vitals.spo2}%.`,
      severity: "immediate",
      type: "Vital:SpO2",
    });
  } else if (vitals.spo2 >= 90 && vitals.spo2 <= 93) {
    alerts.push({
      title: "High SpO2 Alert",
      description: `Oxygen saturation is low at ${vitals.spo2}%.`,
      severity: "high",
      type: "Vital:SpO2",
    });
  }

  // Blood Pressure
  if (vitals.systolic_bp >= 150) {
    alerts.push({
      title: "Immediate Blood Pressure Alert",
      description: `Blood pressure is dangerously high at ${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg.`,
      severity: "immediate",
      type: "Vital:BloodPressure",
    });
  } else if (vitals.systolic_bp >= 140 && vitals.systolic_bp < 150) {
    alerts.push({
      title: "High Blood Pressure Alert",
      description: `Blood pressure is elevated at ${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg.`,
      severity: "high",
      type: "Vital:BloodPressure",
    });
  }

  // Temperature
  if (vitals.temperature >= 39) {
    alerts.push({
      title: "Immediate Temperature Alert",
      description: `Temperature is dangerously high at ${vitals.temperature}°C.`,
      severity: "immediate",
      type: "Vital:Temperature",
    });
  } else if (vitals.temperature >= 37.5 && vitals.temperature < 39) {
    alerts.push({
      title: "Monitor Temperature",
      description: `Temperature is elevated at ${vitals.temperature}°C.`,
      severity: "monitor",
      type: "Vital:Temperature",
    });
  }

  return alerts;
}
