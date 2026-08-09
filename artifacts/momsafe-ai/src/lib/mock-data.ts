export const user = {
  name: "Sarah Jenkins",
  age: 29,
  week: 32,
  dueDate: "2025-08-14",
  bloodType: "O+",
  obName: "Dr. Priya Sharma",
  hospital: "City General Hospital",
  avatar: "/images/avatar.png",
};

export const riskScore = {
  value: 27,
  level: "Low",
  change: -3,
  confidence: 94,
  explanation: "Your vitals are stable and within expected ranges for Week 32. Mild weight trend noted — continue monitoring.",
  lastUpdated: "Just now",
};

export const vitals = [
  { id: "hr", label: "Heart Rate", value: 82, unit: "bpm", status: "normal", trend: "stable", change: "+2", history: [78, 80, 82, 81, 84, 82, 83, 82] },
  { id: "bp", label: "Blood Pressure", value: "118/76", unit: "mmHg", status: "normal", trend: "stable", change: "-2", history: [120, 118, 122, 116, 118, 119, 117, 118] },
  { id: "spo2", label: "SpO2", value: 98, unit: "%", status: "normal", trend: "stable", change: "0", history: [97, 98, 98, 99, 98, 98, 97, 98] },
  { id: "temp", label: "Temperature", value: 36.8, unit: "°C", status: "normal", trend: "stable", change: "+0.1", history: [36.6, 36.7, 36.8, 36.7, 36.9, 36.8, 36.8, 36.8] },
  { id: "weight", label: "Weight", value: 68.2, unit: "kg", status: "warning", trend: "up", change: "+0.4", history: [67.4, 67.6, 67.8, 67.9, 68.0, 68.1, 68.0, 68.2] },
];

export const alerts = [
  { id: 1, severity: "warning", title: "Elevated Heart Rate", description: "Resting HR above 90 bpm for 2 hours", time: "10 mins ago", category: "Vital" },
  { id: 2, severity: "critical", title: "Missed Medication", description: "Prenatal Vitamin scheduled for 9:00 AM was missed", time: "2 hours ago", category: "Medication" },
  { id: 3, severity: "info", title: "Low Water Intake", description: "Only 0.5L logged today. Goal is 2.5L", time: "4 hours ago", category: "Nutrition" },
  { id: 4, severity: "warning", title: "Weight Increase Trend", description: "0.4kg gain over 3 days — monitor edema", time: "Yesterday", category: "Vital", acknowledged: true },
  { id: 5, severity: "info", title: "Routine Check-up Due", description: "OB appointment recommended this week", time: "2 days ago", category: "Schedule", resolved: true },
];

export const aiRecommendations = [
  { id: 1, priority: "high", title: "Increase Water Intake", description: "You're at 48% of daily hydration goal. Drink 1.3L more today.", action: "Log Water" },
  { id: 2, priority: "medium", title: "Take Prenatal Vitamin", description: "Missed morning dose. Take now with a small meal.", action: "Mark Taken" },
  { id: 3, priority: "low", title: "15 Min Rest", description: "Your heart rate elevated during afternoon. Short rest recommended.", action: "Start Timer" },
];

export const dailyPlan = [
  { time: "Morning", tasks: ["Prenatal Vitamin with breakfast", "Log morning vitals", "15 min light walk"] },
  { time: "Afternoon", tasks: ["Hydration check-in (goal: 1.5L by now)", "Elevate legs for 20 mins"] },
  { time: "Evening", tasks: ["Calcium supplement", "Wind down routine: no screens", "Log dinner and mood"] },
];

export const activityFeed = [
  { id: 1, event: "Vital Check", detail: "Heart rate: 82 bpm — Normal", time: "5 mins ago", type: "vital" },
  { id: 2, event: "Medication", detail: "Iron Supplement taken", time: "2:05 PM", type: "medication" },
  { id: 3, event: "Nutrition Log", detail: "Lunch logged — 620 kcal", time: "1:30 PM", type: "nutrition" },
  { id: 4, event: "Alert", detail: "Weight trend flagged for review", time: "12:00 PM", type: "alert" },
];

export const secondaryMetrics = {
  hydration: { value: 1.2, goal: 2.5, unit: "L", pct: 48 },
  sleep: { value: 7.2, unit: "hrs", quality: "Good", pct: 80 },
  medication: { taken: 2, total: 3, pct: 67 },
};

export const trendData = {
  "24h": Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    hr: 75 + Math.round(Math.sin(i / 3) * 8 + Math.random() * 5),
    bp: 115 + Math.round(Math.sin(i / 4) * 6 + Math.random() * 4),
    spo2: 97 + Math.round(Math.random() * 2),
  })),
  "7d": Array.from({ length: 7 }, (_, i) => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return {
      time: days[i],
      hr: 80 + Math.round(Math.sin(i) * 4 + Math.random() * 3),
      bp: 118 + Math.round(Math.sin(i / 2) * 4 + Math.random() * 3),
      spo2: 97 + Math.round(Math.random() * 2),
    };
  }),
};

export const nutrition = {
  calories: { consumed: 1850, goal: 2200 },
  protein: { consumed: 65, goal: 80, unit: "g" },
  carbs: { consumed: 210, goal: 250, unit: "g" },
  fat: { consumed: 55, goal: 70, unit: "g" },
  fiber: { consumed: 18, goal: 25, unit: "g" },
  water: { consumed: 1.2, goal: 2.5, unit: "L" },
  meals: [
    { name: "Breakfast", time: "8:30 AM", calories: 520, items: ["Oatmeal with berries", "Greek yogurt", "Orange juice"] },
    { name: "Lunch", time: "1:00 PM", calories: 680, items: ["Grilled chicken salad", "Whole wheat bread", "Apple"] },
    { name: "Dinner", time: "—", calories: 0, items: [], pending: true },
  ],
  weeklyData: [
    { day: "Mon", calories: 2150 }, { day: "Tue", calories: 1980 },
    { day: "Wed", calories: 2200 }, { day: "Thu", calories: 1850 },
    { day: "Fri", calories: 2100 }, { day: "Sat", calories: 1900 },
    { day: "Sun", calories: 1850 },
  ],
  suggestions: ["Spinach & lentil soup", "Greek yogurt with almonds", "Fortified oatmeal", "Salmon with quinoa"],
};

export const medications = [
  { id: 1, name: "Prenatal Vitamin", dose: "1 Tablet", time: "9:00 AM", category: "Supplement", taken: false, color: "blue" },
  { id: 2, name: "Iron Supplement", dose: "65 mg", time: "2:00 PM", category: "Supplement", taken: true, color: "green" },
  { id: 3, name: "Calcium + D3", dose: "500 mg", time: "8:00 PM", category: "Supplement", taken: false, color: "purple" },
];

export const dailyLogs = {
  water: { logged: 1.2, goal: 2.5 },
  sleep: { hours: 7.2, quality: 4, bedtime: "10:30 PM", wakeup: "6:15 AM" },
  mood: 4,
  symptoms: [
    { name: "Fatigue", severity: 2 },
    { name: "Back Pain", severity: 1 },
    { name: "Heartburn", severity: 0 },
    { name: "Swelling", severity: 1 },
  ],
  history: [
    { date: "Mar 18", water: 2.1, sleep: 7.5, mood: 4 },
    { date: "Mar 17", water: 1.8, sleep: 6.8, mood: 3 },
    { date: "Mar 16", water: 2.3, sleep: 7.9, mood: 5 },
    { date: "Mar 15", water: 1.5, sleep: 7.0, mood: 3 },
    { date: "Mar 14", water: 2.0, sleep: 8.1, mood: 4 },
  ],
};

export const analyticsData = {
  weeklyRisk: [
    { week: "W28", risk: 22 }, { week: "W29", risk: 24 },
    { week: "W30", risk: 28 }, { week: "W31", risk: 25 },
    { week: "W32", risk: 27 },
  ],
  correlations: [
    { factor: "Sleep Quality", correlation: 0.78, direction: "negative" },
    { factor: "Hydration", correlation: 0.65, direction: "negative" },
    { factor: "Physical Activity", correlation: 0.55, direction: "negative" },
    { factor: "Stress Level", correlation: 0.82, direction: "positive" },
  ],
  anomalies: [
    { date: "Mar 15", vital: "Heart Rate", value: "96 bpm", expected: "75-88 bpm" },
    { date: "Mar 12", vital: "Blood Pressure", value: "128/84", expected: "110-120/70-80 mmHg" },
  ],
};
