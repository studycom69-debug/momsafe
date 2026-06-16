export interface RiskHealthData {
  heart_rate?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  spo2?: number;
  temperature?: number;
  sleep_hours?: number;
  water_intake?: number;
  water_goal?: number;
  symptoms_count?: number;
  gestational_week?: number;
}

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export interface RiskResult {
  score: number;
  level: RiskLevel;
  breakdown: Record<string, number>;
}

export function calculateRiskScore(data: RiskHealthData): RiskResult {
  let risk = 0;
  const breakdown: Record<string, number> = {};
  let bloodPressureRisk = 0;

  // BLOOD PRESSURE
  if (data.bp_systolic !== undefined) {
    if (data.bp_systolic >= 160) {
      bloodPressureRisk = Math.max(bloodPressureRisk, 25); // severe
    } else if (data.bp_systolic >= 140) {
      bloodPressureRisk = Math.max(bloodPressureRisk, 15); // high
    } else if (data.bp_systolic >= 130) {
      bloodPressureRisk = Math.max(bloodPressureRisk, 5); // mild
    }
  }

  // DIASTOLIC BLOOD PRESSURE (was previously ignored)
  if (data.bp_diastolic !== undefined) {
    if (data.bp_diastolic >= 110) {
      bloodPressureRisk = Math.max(bloodPressureRisk, 25);
    } else if (data.bp_diastolic >= 100) {
      bloodPressureRisk = Math.max(bloodPressureRisk, 18);
    } else if (data.bp_diastolic >= 90) {
      bloodPressureRisk = Math.max(bloodPressureRisk, 12);
    } else if (data.bp_diastolic >= 80) {
      // Mild elevation so stable-but-borderline BP is not always shown as absolute zero risk
      bloodPressureRisk = Math.max(bloodPressureRisk, 4);
    }
  }
  if (bloodPressureRisk > 0) {
    risk += bloodPressureRisk;
    breakdown.blood_pressure = bloodPressureRisk;
  }

  // HEART RATE
  if (data.heart_rate !== undefined) {
    if (data.heart_rate >= 120) {
      risk += 20;
      breakdown.heart_rate = 20;
    } else if (data.heart_rate >= 100) {
      risk += 10;
      breakdown.heart_rate = 10;
    } else if (data.heart_rate < 60) {
      risk += 8;
      breakdown.heart_rate = 8;
    }
  }

  // TEMPERATURE
  if (data.temperature !== undefined) {
    if (data.temperature >= 39) {
      risk += 20;
      breakdown.temperature = 20;
    } else if (data.temperature >= 38) {
      risk += 10;
      breakdown.temperature = 10;
    }
  }

  // SPO2
  if (data.spo2 !== undefined) {
    if (data.spo2 < 90) {
      risk += 20;
      breakdown.spo2 = 20;
    } else if (data.spo2 < 94) {
      risk += 10;
      breakdown.spo2 = 10;
    }
  }

  // SLEEP
  if (data.sleep_hours !== undefined) {
    if (data.sleep_hours < 5) {
      risk += 12;
      breakdown.sleep = 12;
    } else if (data.sleep_hours < 6) {
      risk += 8;
      breakdown.sleep = 8;
    }
  }

  // WATER
  if (data.water_intake !== undefined) {
    if (data.water_intake < 1) {
      risk += 10;
      breakdown.hydration = 10;
    } else if (data.water_intake < 1.5) {
      risk += 6;
      breakdown.hydration = 6;
    }
  }

  // SYMPTOMS
  if (data.symptoms_count !== undefined) {
    if (data.symptoms_count >= 3) {
      risk += 15;
      breakdown.symptoms = 15;
    } else if (data.symptoms_count > 0) {
      risk += 8;
      breakdown.symptoms = 8;
    }
  }

  // PREGNANCY FACTOR
  if (data.gestational_week !== undefined && data.gestational_week >= 32) {
    risk += 5;
    breakdown.pregnancy_factor = 5;
  }

  // CAP MAX
  if (risk > 100) risk = 100;

  // Final score mapping
  let level: RiskLevel = "Low";
  if (risk >= 75) level = "Critical";
  else if (risk >= 50) level = "High";
  else if (risk >= 25) level = "Moderate";

  return {
    score: risk,
    level,
    breakdown,
  };
}
