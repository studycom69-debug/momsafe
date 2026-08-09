import {
  Brain,
  CheckCircle,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Loader2,
  Droplets,
  HeartPulse,
  ArrowRight,
  Shield,
  Activity,
  Zap,
  RefreshCcw,
  Baby,
  Heart,
  Wind,
  AlertTriangle,
  Calendar,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Star,
} from "lucide-react";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ElementType,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type TimeOfDayKey = "morning" | "afternoon" | "evening" | "night";
type AlertLevel = "red" | "amber" | "green";
type BreathingPhase = "inhale" | "hold" | "exhale";
type BreathingMode = "calm" | "labor";

// ─── BABY WEEK DATA ───────────────────────────────────────────────────────────
const BABY_DATA: Record<
  number,
  {
    size: string;
    emoji: string;
    weight: string;
    development: string;
    feel: string;
  }
> = {
  4: {
    size: "Poppy seed",
    emoji: "🌱",
    weight: "<1g",
    development:
      "The neural tube — foundation of brain and spine — is forming. Heart starts beating.",
    feel: "You may notice a missed period and early fatigue.",
  },
  6: {
    size: "Sweet pea",
    emoji: "🫛",
    weight: "2g",
    development:
      "Tiny facial features begin to form. Nose, eyes and ears are starting to appear.",
    feel: "Nausea and breast tenderness are common now.",
  },
  8: {
    size: "Kidney bean",
    emoji: "🫘",
    weight: "3g",
    development:
      "All major organs are forming. Tiny fingers and toes are visible.",
    feel: "Morning sickness may peak this week. Eat small frequent meals.",
  },
  10: {
    size: "Strawberry",
    emoji: "🍓",
    weight: "4g",
    development:
      "Baby can make small movements. The vital organs are almost fully formed.",
    feel: "Fatigue is very normal. Your uterus is growing rapidly.",
  },
  12: {
    size: "Lime",
    emoji: "🍋",
    weight: "14g",
    development:
      "Baby is fully formed and starting to move actively. Reflexes are developing.",
    feel: "Nausea may begin to ease. Energy levels often improve this week.",
  },
  14: {
    size: "Lemon",
    emoji: "🍋",
    weight: "43g",
    development:
      "Baby can squint, frown and make sucking motions. Fingerprints are forming.",
    feel: "You might start showing a small bump. Appetite may return.",
  },
  16: {
    size: "Avocado",
    emoji: "🥑",
    weight: "100g",
    development: "Baby can hear sounds outside the womb. Bones are hardening.",
    feel: "Some women feel first movements — like butterflies — around this time.",
  },
  18: {
    size: "Bell pepper",
    emoji: "🫑",
    weight: "190g",
    development:
      "Baby is yawning, hiccupping and rolling. The nervous system is developing rapidly.",
    feel: "You may feel definite movement (quickening) for the first time.",
  },
  20: {
    size: "Banana",
    emoji: "🍌",
    weight: "300g",
    development: "Halfway there! Baby can swallow and has a sleep/wake cycle.",
    feel: "Kicks and jabs are becoming more frequent and noticeable.",
  },
  22: {
    size: "Coconut",
    emoji: "🥥",
    weight: "430g",
    development:
      "Baby's sense of touch is developing. Eyebrows and lashes are forming.",
    feel: "Back pain and round ligament pain may increase.",
  },
  24: {
    size: "Corn on cob",
    emoji: "🌽",
    weight: "600g",
    development: "Baby's lungs are developing. Taste buds are fully formed.",
    feel: "You may feel braxton hicks contractions — practice contractions.",
  },
  26: {
    size: "Scallion bunch",
    emoji: "🌿",
    weight: "760g",
    development: "Eyes can open and close. Baby responds to sound and light.",
    feel: "Shortness of breath and heartburn may become more common.",
  },
  28: {
    size: "Eggplant",
    emoji: "🍆",
    weight: "1.0kg",
    development:
      "Baby can blink and has eyelashes. Brain is developing rapidly with complex patterns.",
    feel: "You may notice stronger, more regular kicks. Sleep may get harder.",
  },
  30: {
    size: "Cabbage",
    emoji: "🥬",
    weight: "1.3kg",
    development:
      "Baby is gaining weight rapidly. Brain surface wrinkles are forming.",
    feel: "Heartburn, swelling and back pain are common. Rest when you can.",
  },
  32: {
    size: "Squash",
    emoji: "🥒",
    weight: "1.7kg",
    development:
      "Baby is practicing breathing movements. Most major development is complete.",
    feel: "Pelvic pressure increases as baby settles lower. Braxton Hicks increase.",
  },
  34: {
    size: "Cantaloupe",
    emoji: "🍈",
    weight: "2.1kg",
    development:
      "Baby's fingernails reach fingertips. Central nervous system is maturing.",
    feel: "You may feel heavy and uncomfortable. Nesting instincts often kick in.",
  },
  36: {
    size: "Papaya",
    emoji: "🍑",
    weight: "2.6kg",
    development:
      "Baby is gaining about 1oz per day. Most babies turn head-down this week.",
    feel: "Breathing may get easier as baby drops. Pelvic pressure increases.",
  },
  38: {
    size: "Pumpkin",
    emoji: "🎃",
    weight: "3.1kg",
    development:
      "Baby is fully developed and ready. Fat deposits continue to build up.",
    feel: "You may experience lightning crotch — sharp pelvic pain. Almost there!",
  },
  40: {
    size: "Watermelon",
    emoji: "🍉",
    weight: "3.4kg",
    development:
      "Full term! Baby is fully ready to meet you. All systems are go.",
    feel: "You may feel a mix of excitement and anxiety. Trust your body.",
  },
  42: {
    size: "Pumpkin",
    emoji: "🎃",
    weight: "3.6kg",
    development:
      "Baby is postterm but doing well. Your doctor will discuss next steps.",
    feel: "You're so close! Stay in close contact with your healthcare provider.",
  },
};

function getBabyData(week: number) {
  if (!week || week < 4) return BABY_DATA[4];
  const keys = Object.keys(BABY_DATA)
    .map(Number)
    .sort((a, b) => a - b);
  const closest = keys.reduce((prev, curr) =>
    Math.abs(curr - week) < Math.abs(prev - week) ? curr : prev,
  );
  return BABY_DATA[closest];
}

// ─── WEEKLY CHECKLIST ─────────────────────────────────────────────────────────
function getChecklistForWeek(
  week: number,
): { task: string; category: string }[] {
  if (week <= 0) return [];
  if (week <= 12)
    return [
      { task: "Schedule first prenatal appointment", category: "appointment" },
      { task: "Start prenatal vitamins with folic acid", category: "health" },
      { task: "Avoid alcohol, smoking, and raw fish", category: "safety" },
      {
        task: "Discuss genetic testing options with doctor",
        category: "medical",
      },
      { task: "Calculate your due date", category: "prep" },
    ];
  if (week <= 20)
    return [
      { task: "Schedule anatomy scan (Week 18-20)", category: "appointment" },
      { task: "Consider finding a pediatrician", category: "prep" },
      { task: "Start researching childbirth classes", category: "prep" },
      { task: "Discuss screening results with doctor", category: "health" },
      { task: "Begin sleeping on your left side", category: "health" },
    ];
  if (week <= 27)
    return [
      {
        task: "Schedule glucose tolerance test (Week 24-28)",
        category: "appointment",
      },
      { task: "Begin counting kicks daily", category: "health" },
      { task: "Start thinking about your birth plan", category: "prep" },
      { task: "Ask about iron supplement if needed", category: "health" },
      { task: "Research cord blood banking options", category: "prep" },
    ];
  if (week <= 35)
    return [
      { task: "Schedule hospital pre-registration", category: "appointment" },
      { task: "Book hospital tour or virtual tour", category: "prep" },
      { task: "Finalize your birth plan", category: "prep" },
      {
        task: "Schedule Group B strep test (Week 36)",
        category: "appointment",
      },
      { task: "Begin packing your hospital bag", category: "prep" },
    ];
  return [
    { task: "Pack hospital bag", category: "prep" },
    { task: "Install and inspect car seat", category: "safety" },
    { task: "Confirm pediatrician choice", category: "prep" },
    { task: "Know the signs of labor", category: "health" },
    { task: "Save hospital number in your phone", category: "safety" },
  ];
}

// ─── SAFETY ALERTS ────────────────────────────────────────────────────────────
function getSafetyAlerts(
  week: number,
): { level: AlertLevel; title: string; detail: string }[] {
  if (week <= 0) return [];
  if (week <= 12)
    return [
      {
        level: "amber",
        title: "Watch for: Heavy bleeding or severe cramping",
        detail:
          "Some light spotting is normal but heavy bleeding or severe cramping needs immediate medical attention.",
      },
      {
        level: "green",
        title: "Normal: Fatigue and morning sickness",
        detail:
          "Feeling exhausted and nauseous is very common in the first trimester. Eat small frequent meals and rest often.",
      },
    ];
  if (week <= 20)
    return [
      {
        level: "amber",
        title: "Watch for: Reduced fetal movement",
        detail:
          "After Week 16, you should start feeling some movement. If you notice a significant decrease, contact your provider.",
      },
      {
        level: "green",
        title: "Normal: Round ligament pain",
        detail:
          "Sharp pain on the sides of your abdomen when moving suddenly is normal — it's the ligaments stretching.",
      },
    ];
  if (week <= 28)
    return [
      {
        level: "red",
        title: "Watch for: Signs of preeclampsia",
        detail:
          "Severe headache, blurred vision, sudden swelling of hands/face, or upper abdominal pain — contact your provider immediately.",
      },
      {
        level: "amber",
        title: "Watch for: Preterm labor signs",
        detail:
          "Regular contractions before Week 37, pelvic pressure, or lower back pain that comes and goes. Call your provider.",
      },
      {
        level: "green",
        title: "Normal: Braxton Hicks contractions",
        detail:
          "Irregular, painless tightening of the uterus is normal. They stop when you change position or drink water.",
      },
    ];
  if (week <= 36)
    return [
      {
        level: "red",
        title: "Emergency: Decreased fetal movement",
        detail:
          "If you feel fewer than 10 movements in 2 hours after Week 28, call your provider immediately.",
      },
      {
        level: "amber",
        title: "Watch for: Preeclampsia symptoms",
        detail:
          "Sudden severe headache, vision changes, significant swelling — these need immediate medical attention.",
      },
      {
        level: "green",
        title: "Normal: Pelvic pressure and frequent urination",
        detail:
          "As baby moves lower, pressure on your bladder increases. This is completely normal.",
      },
    ];
  return [
    {
      level: "red",
      title: "Know your labor signs",
      detail:
        "Regular contractions every 5 minutes, water breaking, or bloody show — call your provider and head to the hospital.",
    },
    {
      level: "amber",
      title: "Watch for: Decreased movement",
      detail:
        "Baby should still move regularly at full term. Count kicks daily and contact your provider with any concerns.",
    },
    {
      level: "green",
      title: "Normal: Lightning crotch",
      detail:
        "Sharp, shooting pelvic pain as baby descends is uncomfortable but normal in the final weeks.",
    },
  ];
}

// ─── DOCTOR VISIT PREP ────────────────────────────────────────────────────────
function getDoctorPrep(week: number, _conditions: string): string[] {
  const base = [
    "How is baby's growth and position?",
    "Are my vitals looking good?",
  ];
  if (week <= 12)
    return [
      ...base,
      "What genetic tests do you recommend?",
      "What symptoms should send me to the ER?",
      "Is my weight gain on track?",
    ];
  if (week <= 20)
    return [
      ...base,
      "What did the anatomy scan show?",
      "Should I start iron supplements?",
      "Can you explain the kick counting guidelines?",
    ];
  if (week <= 28)
    return [
      ...base,
      "When should I schedule the glucose test?",
      "What is my Group B strep status?",
      "Can we discuss my birth plan options?",
    ];
  if (week <= 36)
    return [
      ...base,
      "Am I on track for a vaginal birth?",
      "What are the signs I should come in immediately?",
      "When do weekly visits start?",
      "Can we review my birth plan?",
    ];
  return [
    ...base,
    "What are the signs of real labor vs false labor?",
    "When exactly should I go to the hospital?",
    "What happens if I go past my due date?",
  ];
}

// ─── SYMPTOMS ─────────────────────────────────────────────────────────────────
const SYMPTOMS_LIST = [
  "Headache",
  "Nausea",
  "Swelling",
  "Fatigue",
  "Heartburn",
  "Back Pain",
  "Dizziness",
  "Blurred Vision",
];

function getSymptomResult(
  symptoms: string[],
  week: number,
): { level: AlertLevel; message: string; action: string } {
  const has = (s: string) => symptoms.includes(s);
  if (has("Headache") && has("Swelling") && has("Blurred Vision"))
    return {
      level: "red",
      message:
        "This combination may indicate preeclampsia — a serious pregnancy complication.",
      action:
        "Contact your healthcare provider immediately or go to the nearest ER.",
    };
  if (has("Headache") && has("Blurred Vision"))
    return {
      level: "red",
      message: "Headache with vision changes needs urgent evaluation.",
      action: "Call your provider right now.",
    };
  if (has("Dizziness") && has("Blurred Vision"))
    return {
      level: "red",
      message:
        "These symptoms together could indicate elevated blood pressure.",
      action: "Check your BP and contact your provider.",
    };
  if (has("Headache") && has("Swelling") && week >= 20)
    return {
      level: "amber",
      message:
        "This combination warrants monitoring, especially after Week 20.",
      action: "Contact your provider today if symptoms persist or worsen.",
    };
  if (
    symptoms.length === 1 &&
    (has("Heartburn") || has("Fatigue") || has("Back Pain") || has("Nausea"))
  )
    return {
      level: "green",
      message: "This symptom is very common during pregnancy and expected.",
      action: "Rest, stay hydrated, and eat small frequent meals.",
    };
  if (has("Dizziness") || has("Swelling"))
    return {
      level: "amber",
      message: "Monitor this symptom closely.",
      action:
        "Rest, increase water intake, and mention this at your next appointment.",
    };
  return {
    level: "green",
    message: "These symptoms are common in pregnancy.",
    action: "Rest and stay hydrated. Mention them at your next prenatal visit.",
  };
}

// ─── HEALTH SCORE ─────────────────────────────────────────────────────────────
function computeHealthScore(
  vitals: Record<string, any> | null,
  sleep: number,
  water: number,
): number {
  let score = 100;
  if (vitals) {
    if (vitals.heart_rate > 100 || vitals.heart_rate < 60) score -= 15;
    else if (vitals.heart_rate > 90) score -= 7;
    const parts = (vitals.bp || "120/80").split("/").map(Number);
    const sys = parts[0] || 120;
    const dia = parts[1] || 80;
    if (sys > 140 || dia > 90) score -= 20;
    else if (sys > 130 || dia > 85) score -= 10;
    if ((vitals.spo2 || 98) < 95) score -= 15;
    else if ((vitals.spo2 || 98) < 97) score -= 5;
  }
  if (sleep > 0) {
    if (sleep < 5) score -= 15;
    else if (sleep < 6.5) score -= 8;
    else if (sleep < 7) score -= 4;
  }
  if (water > 0) {
    if (water < 1.0) score -= 12;
    else if (water < 1.5) score -= 7;
    else if (water < 2.0) score -= 3;
  }
  return Math.max(0, Math.min(100, score));
}

// ─── TASK HELPERS ─────────────────────────────────────────────────────────────
function getTaskText(item: any): string {
  return typeof item === "string" ? item : item?.task || "";
}
function getTaskType(item: any): string {
  return typeof item === "string" ? "movement" : item?.type || "movement";
}
function getTaskWhy(item: any): string | null {
  return typeof item === "string" ? null : item?.why || null;
}

const TASK_CONFIG: Record<
  string,
  { emoji: string; borderColor: string; badgeCls: string }
> = {
  hydration: {
    emoji: "💧",
    borderColor: "#06b6d4",
    badgeCls: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  movement: {
    emoji: "🚶‍♀️",
    borderColor: "#10b981",
    badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  nutrition: {
    emoji: "🥗",
    borderColor: "#f97316",
    badgeCls: "bg-orange-50 text-orange-700 border-orange-200",
  },
  rest: {
    emoji: "😴",
    borderColor: "#6366f1",
    badgeCls: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  mindfulness: {
    emoji: "🧘‍♀️",
    borderColor: "#8b5cf6",
    badgeCls: "bg-violet-50 text-violet-700 border-violet-200",
  },
};
function getTaskConfig(type: string) {
  return TASK_CONFIG[type] || TASK_CONFIG.movement;
}

const TIME_CONFIG: Record<
  TimeOfDayKey,
  {
    icon: ElementType;
    emoji: string;
    label: string;
    gradientFrom: string;
    textColor: string;
  }
> = {
  morning: {
    icon: Sun,
    emoji: "🌅",
    label: "Morning",
    gradientFrom: "from-amber-500",
    textColor: "text-amber-700",
  },
  afternoon: {
    icon: Sunset,
    emoji: "☀️",
    label: "Afternoon",
    gradientFrom: "from-orange-500",
    textColor: "text-orange-700",
  },
  evening: {
    icon: Moon,
    emoji: "🌙",
    label: "Evening",
    gradientFrom: "from-indigo-500",
    textColor: "text-indigo-700",
  },
  night: {
    icon: Moon,
    emoji: "🌌",
    label: "Night",
    gradientFrom: "from-blue-900",
    textColor: "text-blue-200",
  },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AIGuidance() {
  const { user } = useAuth();

  // ── Data state
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [latestVitals, setLatestVitals] = useState<Record<string, any> | null>(
    null,
  );
  const [todaySleep, setTodaySleep] = useState(0);
  const [todayWater, setTodayWater] = useState(0);

  // ── AI state
  const [guidanceData, setGuidanceData] = useState<Record<string, any> | null>(
    null,
  );
  const [planData, setPlanData] = useState<Record<string, any> | null>(null);

  // ── Loading
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── UI
  const [activePlanTab, setActivePlanTab] = useState<TimeOfDayKey>("morning");
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [checklistChecked, setChecklistChecked] = useState<Set<string>>(
    new Set(),
  );
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);
  const [activeSymptoms, setActiveSymptoms] = useState<string[]>([]);
  const [symptomResult, setSymptomResult] = useState<{
    level: AlertLevel;
    message: string;
    action: string;
  } | null>(null);
  const [symptomSaved, setSymptomSaved] = useState(false);
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingMode, setBreathingMode] = useState<BreathingMode>("calm");
  const [breathingPhase, setBreathingPhase] =
    useState<BreathingPhase>("inhale");
  const [breathingLabel, setBreathingLabel] = useState("Breathe in...");
  const [completionToast, setCompletionToast] = useState(false);
  const breathingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Computed
  const gestationalWeek = profile?.gestational_week || 0;
  const dueDate = profile?.due_date;
  const conditions = profile?.conditions || "None";
  const firstName = profile?.full_name?.split(" ")[0] || "Mom";

  const daysUntilDue = useMemo(() => {
    if (!dueDate) return null;
    const diff = new Date(dueDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [dueDate]);

  const healthScore = useMemo(
    () => computeHealthScore(latestVitals, todaySleep, todayWater),
    [latestVitals, todaySleep, todayWater],
  );
  const babyData = useMemo(
    () => getBabyData(gestationalWeek),
    [gestationalWeek],
  );
  const weeklyChecklist = useMemo(
    () => getChecklistForWeek(gestationalWeek),
    [gestationalWeek],
  );
  const safetyAlerts = useMemo(
    () => getSafetyAlerts(gestationalWeek),
    [gestationalWeek],
  );
  const doctorPrep = useMemo(
    () => getDoctorPrep(gestationalWeek, conditions),
    [gestationalWeek, conditions],
  );

  const timeContext = useMemo(() => {
    const h = new Date().getHours();
    const defaultTab: TimeOfDayKey =
      h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
    const greeting =
      h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
    return { defaultTab, greeting };
  }, []);

  const totalTasks = useMemo(() => {
    if (!planData) return 0;
    return (
      ["morning", "afternoon", "evening", "night"] as TimeOfDayKey[]
    ).reduce(
      (sum, t) => sum + (Array.isArray(planData[t]) ? planData[t].length : 0),
      0,
    );
  }, [planData]);

  const completionPct =
    totalTasks > 0 ? Math.round((checkedTasks.size / totalTasks) * 100) : 0;

  const healthScoreColor =
    healthScore >= 80
      ? { stroke: "#10b981", text: "text-emerald-600", label: "Great" }
      : healthScore >= 60
        ? { stroke: "#f59e0b", text: "text-amber-600", label: "Fair" }
        : { stroke: "#ef4444", text: "text-red-600", label: "Low" };

  const trimester =
    gestationalWeek <= 12
      ? "First Trimester"
      : gestationalWeek <= 26
        ? "Second Trimester"
        : "Third Trimester";

  // ── Fetch all data
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today0 = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [profileRes, vitalsRes, waterRes, sleepRes] = await Promise.all([
        supabase
          .from("users")
          .select(
            "full_name, gestational_week, due_date, conditions, doctor_name",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("water_intake")
          .select("amount_liters")
          .eq("user_id", user.id)
          .gte("recorded_at", today0),
        supabase
          .from("sleep_data")
          .select("sleep_hours")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const prof = profileRes.data;
      const vit = vitalsRes.data;
      const waterSum = (waterRes.data || []).reduce(
        (s: number, e: any) => s + (Number(e.amount_liters) || 0),
        0,
      );
      const slp = sleepRes.data?.sleep_hours || 0;

      if (prof) setProfile(prof);
      if (vit) setLatestVitals(vit);
      setTodayWater(waterSum);
      setTodaySleep(slp);

      const vitals = {
        heart_rate: vit?.heart_rate || 75,
        bp: vit ? `${vit.systolic_bp}/${vit.diastolic_bp}` : "120/80",
        spo2: vit?.spo2 || 98,
        temp: vit?.temperature || 98.6,
      };
      const logs = { sleep: slp || 7, water: waterSum || 2, mood: "normal" };
      const pregnancy = {
        gestational_week: prof?.gestational_week,
        conditions: prof?.conditions || "None",
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-guidance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ guidance: true, vitals, logs, pregnancy }),
        },
      );
      if (res.ok) setGuidanceData(await res.json());
    } catch (err) {
      console.error(err);
      setError("Unable to load your guidance. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Load checklist from localStorage
  useEffect(() => {
    if (!gestationalWeek) return;
    const saved = localStorage.getItem(`checklist-w${gestationalWeek}`);
    if (saved) {
      try {
        setChecklistChecked(new Set(JSON.parse(saved)));
      } catch {
        /* ignore */
      }
    }
  }, [gestationalWeek]);

  // Set plan tab based on time of day
  useEffect(() => {
    setActivePlanTab(timeContext.defaultTab);
  }, [timeContext.defaultTab]);

  // Breathing animation
  useEffect(() => {
    if (!breathingActive) {
      setBreathingPhase("inhale");
      setBreathingLabel("Breathe in...");
      return;
    }
    const phases =
      breathingMode === "calm"
        ? [
            {
              phase: "inhale" as BreathingPhase,
              dur: 4000,
              label: "Breathe in...",
            },
            { phase: "hold" as BreathingPhase, dur: 7000, label: "Hold..." },
            {
              phase: "exhale" as BreathingPhase,
              dur: 8000,
              label: "Breathe out...",
            },
          ]
        : [
            {
              phase: "inhale" as BreathingPhase,
              dur: 5000,
              label: "Breathe in...",
            },
            {
              phase: "exhale" as BreathingPhase,
              dur: 7000,
              label: "Breathe out...",
            },
          ];
    let idx = 0;
    setBreathingPhase(phases[0].phase);
    setBreathingLabel(phases[0].label);
    const tick = () => {
      breathingRef.current = setTimeout(() => {
        idx = (idx + 1) % phases.length;
        setBreathingPhase(phases[idx].phase);
        setBreathingLabel(phases[idx].label);
        tick();
      }, phases[idx].dur);
    };
    tick();
    return () => {
      if (breathingRef.current) clearTimeout(breathingRef.current);
    };
  }, [breathingActive, breathingMode]);

  // ── Handlers
  const generateSmartPlan = async () => {
    if (!user || generatingPlan) return;
    setGeneratingPlan(true);
    try {
      const today0 = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [vitalsRes, waterRes, sleepRes] = await Promise.all([
        supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("water_intake")
          .select("amount_liters")
          .eq("user_id", user.id)
          .gte("recorded_at", today0),
        supabase
          .from("sleep_data")
          .select("sleep_hours")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const vit = vitalsRes.data;
      const waterSum = (waterRes.data || []).reduce(
        (s: number, e: any) => s + (Number(e.amount_liters) || 0),
        0,
      );
      const vitals = {
        heart_rate: vit?.heart_rate || 75,
        bp: vit ? `${vit.systolic_bp}/${vit.diastolic_bp}` : "120/80",
        spo2: vit?.spo2 || 98,
        temp: vit?.temperature || 98.6,
      };
      const logs = {
        sleep: sleepRes.data?.sleep_hours || 7,
        water: waterSum || 2,
        mood: "normal",
      };
      const pregnancy = {
        gestational_week: profile?.gestational_week,
        conditions: profile?.conditions || "None",
      };
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-guidance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ plan: true, vitals, logs, pregnancy }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setPlanData(data.plan);
        setPlanGenerated(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const toggleTask = (key: string) => {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setCompletionToast(true);
        setTimeout(() => setCompletionToast(false), 2500);
      }
      return next;
    });
  };

  const toggleChecklist = (item: string) => {
    setChecklistChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      localStorage.setItem(
        `checklist-w${gestationalWeek}`,
        JSON.stringify([...next]),
      );
      return next;
    });
  };

  const toggleSymptom = (s: string) => {
    setActiveSymptoms((prev) => {
      const next = prev.includes(s)
        ? prev.filter((x) => x !== s)
        : [...prev, s];
      setSymptomResult(
        next.length > 0 ? getSymptomResult(next, gestationalWeek) : null,
      );
      return next;
    });
  };

  const logSymptoms = async () => {
    if (!user || activeSymptoms.length === 0) return;
    try {
      await supabase.from("symptoms").insert(
        activeSymptoms.map((s) => ({
          user_id: user.id,
          description: s,
          recorded_at: new Date().toISOString(),
        })),
      );
      setActiveSymptoms([]);
      setSymptomResult(null);
      setSymptomSaved(true);
      setTimeout(() => setSymptomSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // ── LOADING STATE
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[560px] gap-6">
        <div className="relative flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="absolute w-40 h-40 rounded-full bg-violet-500/20 blur-3xl pointer-events-none"
          />
          <div className="relative w-20 h-20 rounded-full border-[5px] border-violet-100 border-t-violet-600 animate-spin shadow-xl" />
          <Baby className="w-8 h-8 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-violet-600">
            Loading your guidance...
          </p>
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">
            Personalizing for your pregnancy
          </p>
        </div>
      </div>
    );
  }

  // ── ERROR STATE
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="p-4 rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-gray-900">Connection Issue</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            fetchAllData();
          }}
          className="px-6 py-2.5 bg-violet-600 text-white font-black text-sm rounded-xl hover:bg-violet-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── MAIN RENDER
  const ringCircumference = 251;
  const ringOffset =
    ringCircumference - (healthScore / 100) * ringCircumference;

  return (
    <div className="space-y-5 pb-20">
      {/* ══ 1. HERO BANNER ══════════════════════════════════════════════════ */}
      <div className="card p-0 border-2 border-violet-100 bg-white shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-blue-500 to-indigo-400 opacity-[0.06] pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-violet-400/10 blur-3xl pointer-events-none" />
        <div className="p-6 relative z-10">
          <div className="flex items-center justify-between gap-6">
            {/* Left: greeting + info */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-[10px] font-black uppercase tracking-widest border border-violet-200">
                  AI Guidance
                </span>
                <div className="h-1 w-1 rounded-full bg-gray-300" />
                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                  {timeContext.greeting}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  {timeContext.greeting}, {firstName} 👋
                </h1>
                {gestationalWeek > 0 && (
                  <p className="text-base text-gray-500 font-medium mt-1">
                    <span className="font-black text-violet-600">
                      Week {gestationalWeek}
                    </span>{" "}
                    · {trimester}
                  </p>
                )}
              </div>
              {/* Quick vitals row */}
              <div className="flex items-center gap-2 flex-wrap">
                {latestVitals && (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-100">
                      <HeartPulse className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-[11px] font-black text-red-700">
                        {latestVitals.heart_rate} bpm
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-black text-blue-700">
                        {latestVitals.systolic_bp}/{latestVitals.diastolic_bp}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="text-[11px] font-black text-emerald-700">
                        SpO₂ {latestVitals.spo2}%
                      </span>
                    </div>
                  </>
                )}
                {daysUntilDue !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-100">
                    <Heart className="w-3.5 h-3.5 text-pink-500" />
                    <span className="text-[11px] font-black text-pink-700">
                      {daysUntilDue} days to meet baby 💕
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Health Score Ring */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={healthScoreColor.stroke}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 1s ease-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-2xl font-black tracking-tighter ${healthScoreColor.text}`}
                  >
                    {healthScore}
                  </span>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Health
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${healthScoreColor.text}`}
              >
                {healthScoreColor.label}
              </span>
            </div>

            {/* Right: refresh */}
            <button
              onClick={fetchAllData}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-wide shadow-lg hover:bg-gray-800 active:scale-95 transition-all shrink-0"
            >
              <RefreshCcw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ══ 2. THREE-COLUMN ROW ═════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-5">
        {/* Baby This Week */}
        <div className="card p-0 border-2 border-rose-100 bg-white shadow-lg overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-400/8 via-pink-300/5 to-transparent pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-rose-300/10 blur-2xl pointer-events-none" />
          <div className="p-5 relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-rose-50 border border-rose-100 shadow-sm">
                <Baby className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-900 tracking-tight">
                  Baby This Week
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  Week {gestationalWeek || "–"}
                </p>
              </div>
            </div>
            {gestationalWeek > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-5xl">{babyData.emoji}</span>
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      {babyData.size}
                    </p>
                    <p className="text-[11px] text-rose-600 font-bold">
                      {babyData.weight}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                    <p className="text-[9px] text-rose-400 font-black uppercase tracking-widest mb-1">
                      Development
                    </p>
                    <p className="text-[11px] text-gray-700 font-medium leading-relaxed">
                      {babyData.development}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-pink-50/60 border border-pink-100">
                    <p className="text-[9px] text-pink-400 font-black uppercase tracking-widest mb-1">
                      What you may feel
                    </p>
                    <p className="text-[11px] text-gray-700 font-medium leading-relaxed">
                      {babyData.feel}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400 font-medium">
                  Set your gestational week in Settings to see your baby's
                  development.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Journey Timeline */}
        <div className="card p-0 border-2 border-blue-100 bg-white shadow-lg overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/6 to-transparent pointer-events-none" />
          <div className="p-5 relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-50 border border-blue-100 shadow-sm">
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-900 tracking-tight">
                  Your Journey
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  Pregnancy Timeline
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
                <div
                  className="absolute top-0 bottom-0 w-px bg-blue-300/60"
                  style={{ left: "30%" }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-blue-300/60"
                  style={{ left: "67.5%" }}
                />
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, (gestationalWeek / 40) * 100)}%`,
                  }}
                />
                {gestationalWeek > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-violet-500 shadow-lg flex items-center justify-center"
                    style={{
                      left: `calc(${Math.min(95, (gestationalWeek / 40) * 100)}% - 10px)`,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  </div>
                )}
              </div>
              {/* Trimester labels */}
              <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest px-0.5">
                <span>T1</span>
                <span className="ml-4">T2</span>
                <span>T3</span>
                <span>Due</span>
              </div>
              {/* Week labels */}
              <div className="flex justify-between text-[9px] text-gray-400 font-medium px-0.5">
                <span>Wk 1</span>
                <span>Wk 13</span>
                <span>Wk 27</span>
                <span>Wk 40</span>
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-100 text-center">
                <p className="text-xl font-black text-violet-700">
                  {gestationalWeek || "–"}
                </p>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                  Weeks done
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
                <p className="text-xl font-black text-blue-700">
                  {gestationalWeek > 0
                    ? Math.max(0, 40 - gestationalWeek)
                    : "–"}
                </p>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                  Weeks left
                </p>
              </div>
            </div>
            {/* Upcoming milestone */}
            {gestationalWeek > 0 && gestationalWeek < 40 && (
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-2">
                <Star className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-emerald-700 font-bold leading-snug">
                  {gestationalWeek < 12
                    ? "First trimester ends at Week 12"
                    : gestationalWeek < 20
                      ? "Anatomy scan coming up at Week 18-20"
                      : gestationalWeek < 24
                        ? "Glucose test coming at Week 24-28"
                        : gestationalWeek < 36
                          ? "Third trimester starts at Week 27"
                          : "You're almost there! Full term at Week 39+"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* This Week's Checklist */}
        <div className="card p-0 border-2 border-emerald-100 bg-white shadow-lg overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/6 to-transparent pointer-events-none" />
          <div className="p-5 relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 tracking-tight">
                    This Week's To-Do
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Pregnancy checklist
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {checklistChecked.size}/{weeklyChecklist.length}
              </span>
            </div>
            {gestationalWeek > 0 ? (
              <div className="space-y-2">
                {weeklyChecklist.map((item) => {
                  const done = checklistChecked.has(item.task);
                  return (
                    <button
                      key={item.task}
                      onClick={() => toggleChecklist(item.task)}
                      className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-200 ${
                        done
                          ? "bg-emerald-50/70 border-emerald-200 opacity-70"
                          : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${done ? "bg-emerald-500 border-emerald-500" : "bg-white border-gray-200"}`}
                      >
                        {done && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span
                        className={`text-[11px] font-bold leading-snug ${done ? "line-through text-gray-400" : "text-gray-700"}`}
                      >
                        {item.task}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400 font-medium">
                  Set your gestational week in Settings to see your weekly
                  checklist.
                </p>
              </div>
            )}
            {weeklyChecklist.length > 0 && (
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                  style={{
                    width: `${(checklistChecked.size / weeklyChecklist.length) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ 3. MAIN GRID: 8/4 ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-5">
        {/* ─── LEFT COLUMN (col-span-8) ─────────────────────────────────── */}
        <div className="col-span-8 space-y-5">
          {/* AI Smart Plan */}
          <div className="card p-0 border-2 border-gray-100 bg-white shadow-lg overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
            <div className="p-5 relative z-10 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-50 border border-violet-100 shadow-sm">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-900 tracking-tight">
                      Today's Care Plan
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      AI Personalized · Week {gestationalWeek || "–"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {planGenerated && (
                    <div className="text-right">
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                        Progress
                      </p>
                      <p className="text-base font-black text-gray-900">
                        {checkedTasks.size}
                        <span className="text-gray-400 font-medium text-xs">
                          /{totalTasks}
                        </span>
                      </p>
                    </div>
                  )}
                  <button
                    onClick={generateSmartPlan}
                    disabled={generatingPlan}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wide transition-all active:scale-95 shadow-md ${
                      generatingPlan
                        ? "bg-gray-100 text-gray-400"
                        : "bg-violet-600 text-white hover:bg-violet-700"
                    }`}
                  >
                    {generatingPlan ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {generatingPlan
                      ? "Generating..."
                      : planGenerated
                        ? "Regenerate"
                        : "Generate Plan"}
                  </button>
                </div>
              </div>

              {/* Completion bar */}
              {planGenerated && totalTasks > 0 && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full rounded-full ${completionPct >= 100 ? "bg-emerald-500" : "bg-violet-500"}`}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold">
                    {completionPct === 0
                      ? "Start checking off tasks as you complete them"
                      : completionPct < 50
                        ? "Great start! Keep going 💪"
                        : completionPct < 100
                          ? "Halfway there — you're doing amazing! 🌟"
                          : "All done! You crushed it today ✨"}
                  </p>
                </div>
              )}

              {generatingPlan ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 rounded-2xl border-2 border-dashed border-violet-100 bg-violet-50/30">
                  <div className="relative">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                      transition={{ repeat: Infinity, duration: 2.5 }}
                      className="absolute inset-0 bg-violet-500/20 rounded-full blur-2xl"
                    />
                    <div className="relative w-14 h-14 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin shadow-lg" />
                    <Brain className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-violet-600">
                      Creating your personalized plan...
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      Powered by Medical AI
                    </p>
                  </div>
                </div>
              ) : planGenerated && planData ? (
                <>
                  {/* Tab bar */}
                  <div className="flex gap-2">
                    {(
                      [
                        "morning",
                        "afternoon",
                        "evening",
                        "night",
                      ] as TimeOfDayKey[]
                    ).map((t) => {
                      const cfg = TIME_CONFIG[t];
                      const tasks: any[] = planData[t] || [];
                      const doneCount = tasks.filter((_: any, i: number) =>
                        checkedTasks.has(`${t}-${i}`),
                      ).length;
                      return (
                        <button
                          key={t}
                          onClick={() => setActivePlanTab(t)}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all duration-200 ${
                            activePlanTab === t
                              ? "border-violet-500 bg-violet-50 text-violet-700"
                              : "border-gray-100 bg-white text-gray-500 hover:border-violet-200"
                          }`}
                        >
                          <span className="text-base">{cfg.emoji}</span>
                          <span>{cfg.label}</span>
                          {tasks.length > 0 && (
                            <span
                              className={`text-[8px] ${doneCount === tasks.length && tasks.length > 0 ? "text-emerald-500" : "text-gray-400"}`}
                            >
                              {doneCount}/{tasks.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Task cards */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePlanTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2.5"
                    >
                      {(planData[activePlanTab] || []).length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <p className="text-sm font-medium">
                            No tasks for{" "}
                            {TIME_CONFIG[activePlanTab].label.toLowerCase()}{" "}
                            yet.
                          </p>
                        </div>
                      ) : (
                        (planData[activePlanTab] || []).map(
                          (item: any, idx: number) => {
                            const key = `${activePlanTab}-${idx}`;
                            const done = checkedTasks.has(key);
                            const text = getTaskText(item);
                            const type = getTaskType(item);
                            const why = getTaskWhy(item);
                            const cfg = getTaskConfig(type);
                            return (
                              <div
                                key={key}
                                className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                                  done
                                    ? "opacity-60 bg-gray-50 border-gray-100"
                                    : "bg-white border-gray-100 hover:shadow-md hover:border-violet-100"
                                }`}
                                style={{
                                  borderLeftColor: done
                                    ? "#d1d5db"
                                    : cfg.borderColor,
                                  borderLeftWidth: "3px",
                                }}
                              >
                                <div className="p-3.5 flex items-start gap-3">
                                  <div
                                    className={`p-2 rounded-xl ${cfg.badgeCls.split(" ").slice(0, 2).join(" ")} shrink-0`}
                                  >
                                    <span className="text-sm">{cfg.emoji}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`text-sm font-bold leading-snug ${done ? "line-through text-gray-400" : "text-gray-800"}`}
                                    >
                                      {text}
                                    </p>
                                    {why && (
                                      <p className="text-[10px] text-gray-400 font-medium mt-0.5 leading-snug">
                                        {why}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => toggleTask(key)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 mt-0.5 ${
                                      done
                                        ? "bg-emerald-500 border-emerald-500"
                                        : "bg-white border-gray-200 hover:border-emerald-400"
                                    }`}
                                  >
                                    {done && (
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          },
                        )
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-5 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/40">
                  <div className="relative">
                    <div className="absolute inset-0 bg-violet-500/15 rounded-2xl blur-xl" />
                    <div
                      className="relative p-6 rounded-2xl bg-white shadow-lg border border-gray-50 hover:scale-105 transition-all duration-300 cursor-pointer"
                      onClick={generateSmartPlan}
                    >
                      <Sparkles className="w-12 h-12 text-violet-600" />
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-violet-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-black text-gray-900">
                      Generate Your Care Plan
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-1 max-w-[280px] mx-auto leading-relaxed">
                      Get a personalized daily plan built from your vitals,
                      sleep quality, and Week {gestationalWeek || "–"} pregnancy
                      stage.
                    </p>
                  </div>
                  <button
                    onClick={generateSmartPlan}
                    className="px-8 py-3 bg-violet-600 text-white text-sm font-black rounded-xl hover:bg-violet-700 shadow-lg transition-all active:scale-95"
                  >
                    Create My Plan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Priority Focus */}
          {guidanceData?.focus && (
            <div className="card p-0 border-2 border-blue-100 bg-white shadow-lg overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              <div className="p-5 relative z-10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 shadow-sm">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-900 tracking-tight">
                      Priority Focus
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      AI Clinical Insight
                    </p>
                  </div>
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  {guidanceData.focus.primary}
                </h3>
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium leading-relaxed italic">
                    "{guidanceData.focus.reason}"
                  </p>
                </div>
                {guidanceData?.context?.why && (
                  <div className="p-3 rounded-xl bg-gray-50/60 border border-gray-100 flex items-start gap-2.5">
                    <Brain className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                      {guidanceData.context.why}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT SIDEBAR (col-span-4) ──────────────────────────────── */}
        <div className="col-span-4 space-y-5">
          {/* Do This First */}
          {guidanceData && (
            <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-blue-400/30 blur-3xl pointer-events-none"
              />
              <div className="p-5 relative z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/15 shadow-sm">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white tracking-tight">
                      Do This First
                    </p>
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">
                      Top priority
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-white/90 leading-snug">
                  {guidanceData?.focus?.primary
                    ? `Focus on ${guidanceData.focus.primary}`
                    : "Take a deep breath and stay hydrated"}
                </p>
                {guidanceData?.preventive?.[0] && (
                  <p className="text-[11px] text-white/70 leading-snug">
                    {guidanceData.preventive[0]?.desc ||
                      guidanceData.preventive[0]}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Health Watch: Safety Alert + Symptom Log */}
          <div className="card p-0 border-2 border-gray-100 bg-white shadow-lg overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/6 to-transparent pointer-events-none" />
            <div className="p-5 relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-100 shadow-sm">
                  <Shield className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 tracking-tight">
                    Health Watch
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Week {gestationalWeek || "–"} Alerts
                  </p>
                </div>
              </div>

              {/* Safety Alerts */}
              <div className="space-y-2">
                {safetyAlerts.length > 0 ? (
                  safetyAlerts.map((alert, i) => {
                    const colors = {
                      red: {
                        border: "border-l-red-500",
                        bg: "bg-red-50/60",
                        icon: "text-red-500",
                      },
                      amber: {
                        border: "border-l-amber-400",
                        bg: "bg-amber-50/60",
                        icon: "text-amber-500",
                      },
                      green: {
                        border: "border-l-emerald-500",
                        bg: "bg-emerald-50/60",
                        icon: "text-emerald-500",
                      },
                    };
                    const c = colors[alert.level];
                    const textColor =
                      alert.level === "red"
                        ? "text-red-800"
                        : alert.level === "amber"
                          ? "text-amber-800"
                          : "text-emerald-800";
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border ${c.bg} overflow-hidden`}
                      >
                        <button
                          onClick={() =>
                            setExpandedAlert(expandedAlert === i ? null : i)
                          }
                          className={`w-full text-left p-3 border-l-2 ${c.border} transition-all`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-[11px] font-bold leading-snug ${textColor}`}
                            >
                              {alert.title}
                            </p>
                            {expandedAlert === i ? (
                              <ChevronUp
                                className={`w-3.5 h-3.5 shrink-0 ${c.icon}`}
                              />
                            ) : (
                              <ChevronDown
                                className={`w-3.5 h-3.5 shrink-0 ${c.icon}`}
                              />
                            )}
                          </div>
                        </button>
                        <AnimatePresence>
                          {expandedAlert === i && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <p className="px-3 pb-3 text-[10px] text-gray-600 font-medium leading-relaxed">
                                {alert.detail}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-gray-400 text-center py-4">
                    Set your gestational week to see relevant health alerts.
                  </p>
                )}
              </div>

              {/* Symptom Quick Log */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                  How do you feel right now?
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SYMPTOMS_LIST.map((s) => {
                    const active = activeSymptoms.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSymptom(s)}
                        className={`px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all duration-200 text-left ${
                          active
                            ? "bg-amber-100 text-amber-800 border-amber-300 shadow-sm"
                            : "bg-gray-50 text-gray-600 border-gray-100 hover:border-amber-200 hover:bg-amber-50/60"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                {symptomResult && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl border ${
                        symptomResult.level === "red"
                          ? "bg-red-50 border-red-200"
                          : symptomResult.level === "amber"
                            ? "bg-amber-50 border-amber-200"
                            : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {symptomResult.level === "red" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        {symptomResult.level === "amber" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        {symptomResult.level === "green" && (
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <p
                            className={`text-[10px] font-black ${
                              symptomResult.level === "red"
                                ? "text-red-700"
                                : symptomResult.level === "amber"
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                            }`}
                          >
                            {symptomResult.message}
                          </p>
                          <p
                            className={`text-[9px] font-medium ${
                              symptomResult.level === "red"
                                ? "text-red-600"
                                : symptomResult.level === "amber"
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }`}
                          >
                            {symptomResult.action}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
                {activeSymptoms.length > 0 && (
                  <button
                    onClick={logSymptoms}
                    className="w-full py-2 rounded-xl bg-amber-500 text-white text-[11px] font-black uppercase tracking-wide hover:bg-amber-600 transition-all active:scale-95"
                  >
                    {symptomSaved
                      ? "✓ Logged!"
                      : `Log ${activeSymptoms.length} Symptom${activeSymptoms.length > 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Breathing & Calm */}
          <div className="card p-0 border-2 border-indigo-100 bg-white shadow-lg overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/6 to-transparent pointer-events-none" />
            <div className="p-5 relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100 shadow-sm">
                    <Wind className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 tracking-tight">
                      Breathing & Calm
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      Guided relaxation
                    </p>
                  </div>
                </div>
                {breathingActive && (
                  <button
                    onClick={() => setBreathingActive(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Mode selector */}
              <div className="flex gap-2">
                {(["calm", "labor"] as BreathingMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setBreathingMode(m);
                      setBreathingActive(false);
                    }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all ${
                      breathingMode === m
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {m === "calm" ? "😌 Calm Anxiety" : "🤱 Labor Prep"}
                  </button>
                ))}
              </div>

              {/* Animated circle */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative flex items-center justify-center">
                  <motion.div
                    animate={
                      breathingActive
                        ? {
                            scale:
                              breathingPhase === "inhale"
                                ? 1.4
                                : breathingPhase === "hold"
                                  ? 1.4
                                  : 1,
                            opacity: breathingPhase === "hold" ? 0.9 : 0.7,
                          }
                        : { scale: 1 }
                    }
                    transition={{
                      duration:
                        breathingPhase === "inhale"
                          ? breathingMode === "calm"
                            ? 4
                            : 5
                          : breathingPhase === "hold"
                            ? 0.1
                            : breathingMode === "calm"
                              ? 8
                              : 7,
                      ease: "easeInOut",
                    }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 opacity-70 blur-sm absolute"
                  />
                  <motion.div
                    animate={
                      breathingActive
                        ? {
                            scale:
                              breathingPhase === "inhale"
                                ? 1.3
                                : breathingPhase === "hold"
                                  ? 1.3
                                  : 1,
                          }
                        : { scale: 1 }
                    }
                    transition={{
                      duration:
                        breathingPhase === "inhale"
                          ? breathingMode === "calm"
                            ? 4
                            : 5
                          : breathingPhase === "hold"
                            ? 0.1
                            : breathingMode === "calm"
                              ? 8
                              : 7,
                      ease: "easeInOut",
                    }}
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-300 to-violet-400 flex items-center justify-center shadow-xl cursor-pointer"
                    onClick={() => setBreathingActive(!breathingActive)}
                  >
                    <Wind className="w-7 h-7 text-white" />
                  </motion.div>
                </div>
                {breathingActive ? (
                  <p className="text-sm font-black text-indigo-600 animate-pulse">
                    {breathingLabel}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 font-medium">
                    Tap circle to start
                  </p>
                )}
                <p className="text-[9px] text-gray-400 font-medium text-center">
                  {breathingMode === "calm"
                    ? "4-7-8 pattern · Reduces anxiety & lowers BP"
                    : "5-7 deep pattern · Labor & delivery preparation"}
                </p>
              </div>
            </div>
          </div>

          {/* Doctor Visit Prep */}
          <div className="card p-0 border-2 border-teal-100 bg-white shadow-lg overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-400/6 to-transparent pointer-events-none" />
            <div className="p-5 relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-teal-50 border border-teal-100 shadow-sm">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 tracking-tight">
                    Doctor Visit Prep
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Questions to ask
                  </p>
                </div>
              </div>
              {gestationalWeek > 0 ? (
                <div className="space-y-2">
                  {doctorPrep.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-teal-50/60 border border-teal-100"
                    >
                      <span className="text-[10px] font-black text-teal-600 shrink-0 mt-0.5">
                        {i + 1}.
                      </span>
                      <p className="text-[11px] text-gray-700 font-medium leading-snug">
                        {q}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 text-center py-4">
                  Set your gestational week to get relevant questions.
                </p>
              )}
            </div>
          </div>

          {/* Preventive Care */}
          {guidanceData?.preventive && guidanceData.preventive.length > 0 && (
            <div className="card p-0 border-2 border-emerald-100 bg-white shadow-lg overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/6 to-transparent pointer-events-none" />
              <div className="p-5 relative z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 tracking-tight">
                      Preventive Care
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      Proactive health
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {guidanceData.preventive
                    .slice(0, 3)
                    .map((p: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-emerald-200 transition-all duration-200"
                      >
                        <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-gray-900">
                            {p.title || p}
                          </p>
                          {p.desc && (
                            <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-snug">
                              {p.desc}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Completion Toast ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {completionToast && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl bg-gray-900 text-white shadow-2xl flex items-center gap-4 border border-white/10"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Task Complete
              </p>
              <p className="text-sm font-bold">
                Keep it up! {completionPct}% done today 🌟
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
