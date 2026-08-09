export type Severity = "high" | "medium" | "low";

export interface GuidanceItem {
  title: string;
  description: string;
  shortDescription: string;
  action: string; // Keep for backward compatibility if needed, but actions is preferred
  actions: string[];
  severity: Severity;
}

export interface VitalHistoryRecord {
  heart_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  spo2?: number;
  temperature?: number;
  weight?: number;
  recorded_at: string;
}

export interface UserHealthData {
  latest: {
    heart_rate?: number;
    bp_systolic?: number;
    bp_diastolic?: number;
    spo2?: number;
    temperature?: number;
    sleep_hours?: number;
    water_intake?: number;
  };
  history: VitalHistoryRecord[];
  pregnancy: {
    gestational_week?: number;
    age?: number;
    medical_conditions?: string[];
  };
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function generateGuidance(data: UserHealthData) {
  const { latest, history, pregnancy } = data;
  const actions: { text: string; severity: Severity }[] = [];

  // CRITICAL CONDITIONS (HIGHEST PRIORITY)
  if (latest.temperature !== undefined && latest.temperature >= 38) {
    actions.push({ text: "You have a fever. Monitor temperature and consult your doctor if it persists", severity: "high" });
  }
  
  if (latest.bp_systolic !== undefined && latest.bp_systolic >= 140) {
    actions.push({ text: "Your blood pressure is elevated. Avoid stress and monitor it regularly", severity: "high" });
  }
  
  if (latest.spo2 !== undefined && latest.spo2 < 94) {
    actions.push({ text: "Your oxygen level is slightly low. Take rest and ensure proper airflow", severity: "high" });
  }

  // MODERATE CONDITIONS
  if (latest.heart_rate !== undefined && latest.heart_rate >= 100) {
    actions.push({ text: "Your heart rate is elevated. Sit down and relax for some time", severity: "medium" });
  }
  
  if (latest.sleep_hours !== undefined && latest.sleep_hours < 6) {
    actions.push({ text: "Try to rest and improve sleep. Aim for at least 7–8 hours", severity: "medium" });
  }
  
  if (latest.water_intake !== undefined && latest.water_intake < 1.5) {
    actions.push({ text: "Drink at least 1L more water today. Aim for 2.5L daily", severity: "medium" });
  }

  // PREGNANCY CONTEXT (IMPORTANT)
  if (pregnancy.gestational_week !== undefined) {
    if (pregnancy.gestational_week >= 28 && pregnancy.gestational_week < 36) {
      actions.push({ text: "You are in the third trimester. Ensure proper rest and avoid overexertion", severity: "low" });
    }
    
    if (pregnancy.gestational_week >= 36) {
      actions.push({ text: "You are nearing delivery. Stay prepared and monitor any unusual symptoms", severity: "low" });
    }
  }

  // FALLBACK
  if (actions.length === 0) {
    actions.push({ text: "Everything looks stable", severity: "low" });
    actions.push({ text: "Continue your current healthy routine", severity: "low" });
  }

  // LIMIT OUTPUT (TOP 2-3 actions)
  const topActions = actions.slice(0, 3);

  return {
    topPriority: {
      title: "Do This Now",
      description: topActions.map(a => a.text).join(". "),
      shortDescription: topActions[0].text,
      action: topActions[0].text,
      actions: topActions.map(a => a.text),
      severity: topActions[0].severity
    },
    secondary: null,
    immediateActions: topActions.map(action => ({
      title: "Do This Now",
      description: action.text,
      shortDescription: action.text,
      action: action.text,
      actions: [action.text],
      severity: action.severity
    }))
  };
}

export function buildHealthContext(data: any) {
  const {
    vitals = {},
    trends = {},
    riskScore = 0,
    sleep = 0,
    hydration = 0,
    symptoms = []
  } = data;

  const hr = vitals.hr || 0;
  const bpSys = vitals.bpSys || 0;
  const bpDia = vitals.bpDia || 0;
  const spo2 = vitals.spo2 || 0;
  const temp = vitals.temp || 0;

  const hrTrend = trends.hrTrend || "stable";
  const bpTrend = trends.bpTrend || "stable";
  const spo2Trend = trends.spo2Trend || "stable";
  const tempTrend = trends.tempTrend || "stable";

  // New boolean trend flags for situation detection
  const bpIncreasing = trends.bpIncreasing === true;
  const spo2Dropping = trends.spo2Dropping === true;

  let riskLevel: "low" | "moderate" | "high" = "low";
  if (riskScore > 70) riskLevel = "high";
  else if (riskScore > 30) riskLevel = "moderate";

  return {
    vitals: { hr, bpSys, bpDia, spo2, temp },
    trends: { hrTrend, bpTrend, spo2Trend, tempTrend, bpIncreasing, spo2Dropping },
    derived: {
      riskScore,
      riskLevel
    },
    lifestyle: {
      sleepHours: sleep,
      hydration
    },
    symptoms: Array.isArray(symptoms) ? symptoms : []
  };
}

export function detectSituations(context: any) {
  const situations: { type: string; priority: number }[] = [];
  const { vitals, trends, lifestyle } = context;

  // 1. Oxygen Critical
  if (vitals.spo2 < 92 && vitals.spo2 > 0) {
    situations.push({ type: "oxygen_critical", priority: 100 });
  }

  // 2. Hypertension Risk
  if (vitals.bpSys > 140 && trends.bpIncreasing === true) {
    situations.push({ type: "hypertension_risk", priority: 80 });
  }

  // 3. Physical Stress
  if (vitals.hr > 110 && lifestyle.sleepHours < 6 && lifestyle.sleepHours > 0) {
    situations.push({ type: "physical_stress", priority: 75 });
  }

  // 4. Dehydration Stress
  if (vitals.hr > 100 && lifestyle.hydration === "low") {
    situations.push({ type: "dehydration_stress", priority: 65 });
  }

  // 5. Oxygen Decline Trend
  if (trends.spo2Dropping === true) {
    situations.push({ type: "oxygen_decline", priority: 70 });
  }

  return situations;
}

export function getTopSituation(situations: { type: string; priority: number }[]) {
  if (!situations || situations.length === 0) return null;
  
  // Sort by priority descending and return first
  const sorted = [...situations].sort((a, b) => b.priority - a.priority);
  return sorted[0];
}
