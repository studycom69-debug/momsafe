import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Apple,
  Plus,
  TrendingUp,
  X,
  Loader2,
  Sparkles,
  Wand2,
  ArrowRight,
  BarChart3,
  Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { getWeekRange, getWeeklyChartData } from "@/lib/nutrition-chart-logic";

function MacroBar({
  label,
  consumed,
  goal,
  unit,
  colorFrom,
  colorTo,
  delayClass = "",
}: {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  colorFrom: string;
  colorTo: string;
  delayClass?: string;
}) {
  const pct = goal > 0 ? Math.round((consumed / goal) * 100) : 0;
  const remaining = Math.max(0, goal - consumed);

  const statusKey =
    consumed === 0
      ? null
      : pct >= 100
        ? "complete"
        : pct >= 80
          ? "good"
          : pct >= 50
            ? "moderate"
            : "low";

  const statusMap: Record<string, { label: string; cls: string }> = {
    complete: {
      label: "Complete",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    good: {
      label: "Good",
      cls: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    moderate: {
      label: "Moderate",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    low: {
      label: "Low",
      cls: "bg-red-50 text-red-600 border-red-200",
    },
  };

  return (
    <div
      className={`macro-card macro-card-enter ${delayClass} relative`}
      style={{
        ["--macro-color" as any]: colorTo,
        ["--macro-color-from" as any]: colorFrom,
        ["--macro-color-to" as any]: colorTo,
        borderLeftColor: colorTo,
        borderLeftWidth: "3px",
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="macro-accent-dot shrink-0" />
          <span className="text-xs font-black text-gray-800 tracking-tight truncate">
            {label}
          </span>
          {statusKey && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 ${statusMap[statusKey].cls}`}
            >
              {statusMap[statusKey].label}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-black" style={{ color: colorTo }}>
            {consumed}
            {unit}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            {" "}
            / {goal}
            {unit}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden macro-track">
        <div
          className="h-full rounded-full macro-fill"
          style={{
            width: `${Math.min(pct, 100)}%`,
            ["--macro-target" as any]: `${Math.min(pct, 100)}%`,
          }}
        />
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[10px] text-gray-400 font-medium">
          {pct}% of daily goal
        </p>
        {pct >= 100 ? (
          <p className="text-[10px] font-black text-emerald-600">✓ Goal met!</p>
        ) : remaining > 0 && consumed > 0 ? (
          <p className="text-[10px] font-bold" style={{ color: colorTo }}>
            {remaining}
            {unit} left
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function Nutrition() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mealType, setMealType] = useState("Breakfast");

  // Guided UX State
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState("");
  const [improvedText, setImprovedText] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [meals, setMeals] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [insight, setInsight] = useState("");
  const [displayCalories, setDisplayCalories] = useState(0);

  const fetchMeals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setMeals(data || []);
  };

  useEffect(() => {
    if (user) {
      fetchMeals();
    }
  }, [user]);

  const todayMeals = meals.filter((meal) => {
    const today = new Date().toDateString();
    return new Date(meal.created_at).toDateString() === today;
  });

  // Dynamic totals from food_logs
  const totalCalories = todayMeals.reduce(
    (sum, item) => sum + (item.calories || 0),
    0,
  );
  const totalProtein = todayMeals.reduce(
    (sum, item) => sum + (item.protein || 0),
    0,
  );
  const totalCarbs = todayMeals.reduce(
    (sum, item) => sum + (item.carbs || 0),
    0,
  );
  const totalFat = todayMeals.reduce((sum, item) => sum + (item.fat || 0), 0);
  const totalFiber = todayMeals.reduce(
    (sum, item) => sum + (item.fiber || 0),
    0,
  );

  // Meal lock logic — Breakfast, Lunch, Dinner can only be logged once per day
  const LOCKABLE_MEALS = ["Breakfast", "Lunch", "Dinner"];

  const loggedMealTypes = useMemo(
    () => new Set(todayMeals.map((m: any) => m.meal_type)),
    [todayMeals],
  );

  const isMealLocked = (type: string) =>
    LOCKABLE_MEALS.includes(type) && loggedMealTypes.has(type);

  const getDefaultMealType = () => {
    const order = ["Breakfast", "Lunch", "Dinner", "Snack"];
    return order.find((t) => !isMealLocked(t)) ?? "Snack";
  };

  // AI Suggestions fetch
  useEffect(() => {
    const fetchAISuggestions = async () => {
      if (!user || todayMeals.length === 0) return;

      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const AI_URL =
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nutrition-`;

      try {
        const res = await fetch(AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            nutrition_insights: true,
            totals: {
              calories: totalCalories,
              protein: totalProtein,
              carbs: totalCarbs,
              fat: totalFat,
              fiber: totalFiber,
            },
          }),
        });

        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setInsight(data.insight || "");
      } catch (error) {
        console.error("Error fetching AI suggestions:", error);
      }
    };

    if (todayMeals.length > 0) {
      fetchAISuggestions();
    }
  }, [totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, user]);

  // 1 & 5. Current-week range calculation with weekly reset behavior
  const [weekRange, setWeekRange] = useState(() => getWeekRange());
  const { weekStart, weekEnd } = weekRange;

  useEffect(() => {
    const interval = setInterval(() => {
      const newRange = getWeekRange();
      if (newRange.weekStart.getTime() !== weekRange.weekStart.getTime()) {
        setWeekRange(newRange);
      }
    }, 1000); // Check every second for rollover
    return () => clearInterval(interval);
  }, [weekRange.weekStart]);

  // 2, 3 & 4. Data filtering, grouping, and mapping for Weekly Calorie Intake chart
  const chartData = useMemo(() => {
    const data = getWeeklyChartData(meals, weekStart, weekEnd);
    console.log("Weekly Calorie Intake - Meals:", meals);
    console.log("Weekly Calorie Intake - Chart Data:", data);
    return data;
  }, [meals, weekRange]);

  // Derived weekly insights
  const weeklyInsights = useMemo(() => {
    const total = chartData.reduce((sum, d) => sum + d.calories, 0);
    const nonZeroDays = chartData.filter((d) => d.calories > 0).length;
    const average = nonZeroDays > 0 ? Math.round(total / nonZeroDays) : 0;
    const maxDay = [...chartData].sort((a, b) => b.calories - a.calories)[0];

    // Status calculation
    const calorieGoal = 2200;
    let status = { label: "No data", color: "bg-gray-100 text-gray-500" };
    if (average > 0) {
      if (average >= calorieGoal * 0.9) {
        status = {
          label: "🟢 On track",
          color: "bg-emerald-50 text-emerald-600 border-emerald-100",
        };
      } else if (average >= calorieGoal * 0.7) {
        status = {
          label: "🟡 Slightly low",
          color: "bg-amber-50 text-amber-600 border-amber-100",
        };
      } else {
        status = {
          label: "🔴 Needs attention",
          color: "bg-rose-50 text-rose-600 border-rose-100",
        };
      }
    }

    return { total, average, maxDay, status, hasData: total > 0 };
  }, [chartData]);

  // Placeholder data for empty state ghost bars
  const placeholderData = [
    { day: "Sun", calories: 1200 },
    { day: "Mon", calories: 1800 },
    { day: "Tue", calories: 1400 },
    { day: "Wed", calories: 2100 },
    { day: "Thu", calories: 1600 },
    { day: "Fri", calories: 1900 },
    { day: "Sat", calories: 1500 },
  ];

  // Nutrition goals
  const calorieGoal = 2200;
  const proteinGoal = 80;
  const carbsGoal = 250;
  const fatGoal = 70;
  const fiberGoal = 25;

  const calPct = Math.round((totalCalories / calorieGoal) * 100);
  const macroCompletionPct = Math.round(
    ((proteinGoal > 0 ? totalProtein / proteinGoal : 0) +
      (carbsGoal > 0 ? totalCarbs / carbsGoal : 0) +
      (fatGoal > 0 ? totalFat / fatGoal : 0) +
      (fiberGoal > 0 ? totalFiber / fiberGoal : 0)) *
      25,
  );

  // Dynamic macro status pills
  const macroStatuses = useMemo(() => {
    const macros = [
      { name: "Protein", consumed: totalProtein, goal: proteinGoal },
      { name: "Carbs", consumed: totalCarbs, goal: carbsGoal },
      { name: "Fat", consumed: totalFat, goal: fatGoal },
      { name: "Fiber", consumed: totalFiber, goal: fiberGoal },
    ];
    return macros.map(({ name, consumed, goal }) => {
      const pct = goal > 0 ? Math.round((consumed / goal) * 100) : 0;
      if (consumed === 0)
        return {
          name,
          pct,
          label: `${name} Not Started`,
          cls: "bg-gray-50 text-gray-400 border-gray-200",
        };
      if (pct >= 100)
        return {
          name,
          pct,
          label: `${name} Complete ✓`,
          cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      if (pct >= 80)
        return {
          name,
          pct,
          label: `${name} Good`,
          cls: "bg-emerald-50 text-emerald-600 border-emerald-200",
        };
      if (pct >= 50)
        return {
          name,
          pct,
          label: `${name} Moderate`,
          cls: "bg-amber-50 text-amber-700 border-amber-200",
        };
      return {
        name,
        pct,
        label: `Low ${name}`,
        cls: "bg-red-50 text-red-600 border-red-100",
      };
    });
  }, [
    totalProtein,
    totalCarbs,
    totalFat,
    totalFiber,
    proteinGoal,
    carbsGoal,
    fatGoal,
    fiberGoal,
  ]);

  // Dynamic suggestion cards — sorted by lowest % first (needs most attention)
  const macroSuggestions = useMemo(() => {
    const all = [
      {
        key: "protein",
        name: "Protein",
        pct:
          proteinGoal > 0 ? Math.round((totalProtein / proteinGoal) * 100) : 0,
        emoji: "💪",
        borderCls: "border-blue-100",
        bgCls: "from-blue-50",
        hoverCls: "hover:border-blue-200",
        labelCls: "text-blue-600",
        iconBg: "bg-blue-100",
        needTitle: "Add protein-rich foods",
        needDesc: "Paneer, eggs, dal",
        okTitle: "Protein intake is good",
        okDesc: "Keep maintaining high-protein meals",
        doneTitle: "Protein goal met! ✓",
        doneDesc: "Excellent protein intake today",
      },
      {
        key: "fiber",
        name: "Fiber",
        pct: fiberGoal > 0 ? Math.round((totalFiber / fiberGoal) * 100) : 0,
        emoji: "🌾",
        borderCls: "border-violet-100",
        bgCls: "from-violet-50",
        hoverCls: "hover:border-violet-200",
        labelCls: "text-violet-600",
        iconBg: "bg-violet-100",
        needTitle: "Increase fiber intake",
        needDesc: "Fruits, oats, vegetables",
        okTitle: "Good fiber intake",
        okDesc: "You're meeting your fiber needs",
        doneTitle: "Fiber goal exceeded! ✓",
        doneDesc: "Great job on high-fiber foods",
      },
      {
        key: "fat",
        name: "Healthy Fat",
        pct: fatGoal > 0 ? Math.round((totalFat / fatGoal) * 100) : 0,
        emoji: "🥑",
        borderCls: "border-amber-100",
        bgCls: "from-amber-50",
        hoverCls: "hover:border-amber-200",
        labelCls: "text-amber-600",
        iconBg: "bg-amber-100",
        needTitle: "Include healthy fats",
        needDesc: "Nuts, seeds, avocado",
        okTitle: "Fat intake balanced",
        okDesc: "You're getting healthy fats",
        doneTitle: "Fat goal reached! ✓",
        doneDesc: "Good balance of healthy fats",
      },
      {
        key: "carbs",
        name: "Carbohydrates",
        pct: carbsGoal > 0 ? Math.round((totalCarbs / carbsGoal) * 100) : 0,
        emoji: "🍚",
        borderCls: "border-violet-100",
        bgCls: "from-violet-50",
        hoverCls: "hover:border-violet-200",
        labelCls: "text-violet-600",
        iconBg: "bg-violet-100",
        needTitle: "Boost carb intake",
        needDesc: "Rice, bread, fruits",
        okTitle: "Carb intake on track",
        okDesc: "Energy levels well balanced",
        doneTitle: "Carb goal met! ✓",
        doneDesc: "Well-fueled for the day",
      },
    ];
    // show lowest % first — most urgent at the top
    return [...all].sort((a, b) => a.pct - b.pct).slice(0, 3);
  }, [
    totalProtein,
    totalFat,
    totalFiber,
    totalCarbs,
    proteinGoal,
    fatGoal,
    fiberGoal,
    carbsGoal,
  ]);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    const to = totalCalories;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayCalories(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [totalCalories]);

  const handleImproveMeal = async () => {
    if (!description) return;
    setLoading(true);
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nutrition-`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            improve: true,
            text: description,
          }),
        },
      );
      const data = await res.json();
      setImprovedText(data.improved);
      setQuestions(data.questions || []);
      setStep(2);
    } catch (error) {
      toast.error("Failed to improve meal description");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeMeal = async () => {
    setLoading(true);
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nutrition-`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            description: improvedText || description,
            answers: answers,
          }),
        },
      );
      const data = await res.json();
      setPreview(data);
      setStep(3);
    } catch (error) {
      toast.error("Failed to analyze meal");
    } finally {
      setLoading(false);
    }
  };

  const handleLogMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !preview) return;

    // Guard: prevent duplicate Breakfast / Lunch / Dinner entries
    if (isMealLocked(mealType)) {
      toast.error(
        `You've already logged ${mealType} today! Each main meal can only be logged once.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("food_logs").insert([
        {
          user_id: user.id,
          meal_type: mealType,
          food_name: improvedText || description,
          calories: preview.calories,
          protein: preview.protein,
          carbs: preview.carbs,
          fat: preview.fat,
          fiber: preview.fiber,
        },
      ]);

      if (error) throw error;

      toast.success("Meal logged successfully");
      await fetchMeals();
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to log meal");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setDescription("");
    setImprovedText("");
    setQuestions([]);
    setAnswers({});
    setPreview(null);
    setMealType("Breakfast");
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Nutrition Tracker</h1>
          <p className="page-subtitle">
            Personalized nutrition monitoring for optimal fetal and maternal
            health.
          </p>
        </div>
        <button
          onClick={() => {
            setMealType(getDefaultMealType());
            setIsModalOpen(true);
          }}
          className="action-btn"
        >
          <Plus className="w-4 h-4" /> Log Meal
        </button>
      </div>

      {/* Calorie overview + macros */}
      <div className="grid grid-cols-3 gap-4 items-stretch">
        {/* Calorie ring — redesigned */}
        <div
          className="card h-full p-0 overflow-hidden relative group border transition-all duration-300 hover:shadow-[0_20px_44px_-20px_rgba(59,130,246,0.22)]"
          style={{
            background:
              "linear-gradient(145deg,#f0f7ff 0%,#ffffff 55%,#f5f0ff 100%)",
            borderColor:
              calPct >= 100 ? "#fecaca" : calPct >= 80 ? "#fde68a" : "#bfdbfe",
          }}
        >
          {/* Corner orbs */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-violet-400/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 p-5 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white shadow-sm border border-blue-100">
                  <Apple className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Today's Calories
                </p>
              </div>
              <div
                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors duration-500 ${
                  totalCalories === 0
                    ? "bg-gray-50 text-gray-400 border-gray-200"
                    : calPct >= 100
                      ? "bg-red-50 text-red-600 border-red-200"
                      : calPct >= 80
                        ? "bg-amber-50 text-amber-600 border-amber-200"
                        : "bg-emerald-50 text-emerald-600 border-emerald-200"
                }`}
              >
                {totalCalories === 0
                  ? "No meals yet"
                  : calPct >= 100
                    ? "✓ Goal reached"
                    : calPct >= 80
                      ? "Almost there!"
                      : "On track"}
              </div>
            </div>

            {/* Ring */}
            <div className="flex-1 flex items-center justify-center py-1">
              <div className="relative w-44 h-44 calories-ring-enter group-hover:scale-[1.04] transition-transform duration-500">
                {/* Hover glow */}
                <div
                  className={`absolute inset-[-10px] rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                    calPct >= 100
                      ? "bg-red-300/30"
                      : calPct >= 80
                        ? "bg-amber-300/30"
                        : "bg-blue-300/30"
                  }`}
                />
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <defs>
                    <linearGradient
                      id="calGradNormal"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#7DB7FA" />
                      <stop offset="45%" stopColor="#4B97F2" />
                      <stop offset="100%" stopColor="#2A74E6" />
                    </linearGradient>
                    <linearGradient
                      id="calGradWarning"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#FCD34D" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                    <linearGradient
                      id="calGradOver"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#FCA5A5" />
                      <stop offset="100%" stopColor="#EF4444" />
                    </linearGradient>
                  </defs>
                  {/* Depth shadow */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeOpacity="0.65"
                    strokeWidth="11"
                    className="calories-ring-depth"
                  />
                  {/* Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#EAF1FF"
                    strokeWidth="9"
                  />
                  {/* Progress */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={
                      calPct >= 100
                        ? "url(#calGradOver)"
                        : calPct >= 80
                          ? "url(#calGradWarning)"
                          : "url(#calGradNormal)"
                    }
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray="251"
                    strokeDashoffset={251 - Math.min(calPct, 100) * 2.51}
                    className="calories-ring-progress"
                    style={{
                      ["--ring-target-offset" as any]:
                        251 - Math.min(calPct, 100) * 2.51,
                    }}
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center calories-text-enter">
                  <span className="text-3xl font-black tracking-tight text-gray-900 leading-none">
                    {displayCalories}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    kcal
                  </span>
                  {totalCalories > 0 && (
                    <span
                      className={`text-[10px] font-black mt-1.5 px-2 py-0.5 rounded-full ${
                        calPct >= 100
                          ? "bg-red-50 text-red-600"
                          : calPct >= 80
                            ? "bg-amber-50 text-amber-600"
                            : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {Math.round(Math.min(calPct, 100))}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stat boxes */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="p-3 rounded-2xl bg-white/80 border border-gray-100 shadow-sm text-center">
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                  Goal
                </p>
                <p className="text-base font-black text-gray-900 mt-0.5 leading-none">
                  {calorieGoal}
                </p>
                <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                  kcal daily
                </p>
              </div>
              <div
                className={`p-3 rounded-2xl border shadow-sm text-center transition-colors duration-500 ${
                  totalCalories === 0
                    ? "bg-white/80 border-gray-100"
                    : calorieGoal - totalCalories <= 0
                      ? "bg-red-50/80 border-red-100"
                      : calorieGoal - totalCalories < 400
                        ? "bg-amber-50/80 border-amber-100"
                        : "bg-emerald-50/80 border-emerald-100"
                }`}
              >
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                  Remaining
                </p>
                <p
                  className={`text-base font-black mt-0.5 leading-none transition-colors duration-500 ${
                    totalCalories === 0
                      ? "text-gray-900"
                      : calorieGoal - totalCalories <= 0
                        ? "text-red-600"
                        : calorieGoal - totalCalories < 400
                          ? "text-amber-600"
                          : "text-emerald-600"
                  }`}
                >
                  {Math.max(0, calorieGoal - totalCalories)}
                </p>
                <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                  kcal left
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                  Progress
                </span>
                <span
                  className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${
                    calPct >= 100
                      ? "text-red-500"
                      : calPct >= 80
                        ? "text-amber-500"
                        : "text-blue-500"
                  }`}
                >
                  {Math.round(Math.min(calPct, 100))}% of {calorieGoal} kcal
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    calPct >= 100
                      ? "bg-gradient-to-r from-red-400 to-red-500"
                      : calPct >= 80
                        ? "bg-gradient-to-r from-amber-300 to-amber-500"
                        : "bg-gradient-to-r from-blue-400 to-blue-600"
                  }`}
                  style={{ width: `${Math.min(calPct, 100)}%` }}
                />
              </div>
            </div>

            {/* Empty nudge */}
            {totalCalories === 0 && (
              <p className="mt-2 text-center text-[10px] text-gray-400 font-medium">
                Log your first meal to start tracking 🍽️
              </p>
            )}
          </div>
        </div>

        {/* Macronutrients */}
        <div className="col-span-2 card h-full p-0 overflow-hidden flex flex-col">
          {/* Card header */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100 shadow-sm">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 tracking-tight">
                  Macronutrients
                </h2>
                <p className="text-[10px] text-gray-400 font-medium">
                  Daily macro breakdown
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                Avg. Completion
              </p>
              <p className="text-xl font-black text-gray-900 leading-none mt-0.5">
                {Math.round(macroCompletionPct)}%
              </p>
            </div>
          </div>

          {/* Macro bars */}
          <div className="p-4 grid grid-cols-2 gap-3 flex-1 [grid-auto-rows:1fr]">
            <MacroBar
              label="Protein"
              consumed={totalProtein}
              goal={proteinGoal}
              unit="g"
              colorFrom="#93C5FD"
              colorTo="#3B82F6"
              delayClass="macro-delay-0"
            />
            <MacroBar
              label="Healthy Fat"
              consumed={totalFat}
              goal={fatGoal}
              unit="g"
              colorFrom="#FDE68A"
              colorTo="#F59E0B"
              delayClass="macro-delay-1"
            />
            <MacroBar
              label="Carbohydrates"
              consumed={totalCarbs}
              goal={carbsGoal}
              unit="g"
              colorFrom="#C4B5FD"
              colorTo="#8B5CF6"
              delayClass="macro-delay-2"
            />
            <MacroBar
              label="Fiber"
              consumed={totalFiber}
              goal={fiberGoal}
              unit="g"
              colorFrom="#86EFAC"
              colorTo="#10B981"
              delayClass="macro-delay-3"
            />
          </div>

          {/* Suggestions footer */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 macro-summary-enter space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-xs font-black text-gray-900">
                  Suggested for You Today
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 macro-summary-fill"
                    style={{
                      ["--macro-summary-target" as any]: `${Math.max(0, Math.min(100, macroCompletionPct))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-black text-gray-500">
                  {Math.round(macroCompletionPct)}%
                </span>
              </div>
            </div>

            {/* Suggestion cards — dynamic, sorted by urgency */}
            <div className="grid grid-cols-3 gap-2">
              {macroSuggestions.map((s) => {
                const isDone = s.pct >= 100;
                const isGood = s.pct >= 80 && s.pct < 100;
                const title = isDone
                  ? s.doneTitle
                  : isGood
                    ? s.okTitle
                    : s.needTitle;
                const desc = isDone
                  ? s.doneDesc
                  : isGood
                    ? s.okDesc
                    : s.needDesc;
                return (
                  <div
                    key={s.key}
                    className={`rounded-2xl border ${s.borderCls} bg-gradient-to-br ${s.bgCls} to-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${s.hoverCls} cursor-default`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div
                        className={`w-5 h-5 rounded-md ${s.iconBg} flex items-center justify-center text-[11px]`}
                      >
                        {isDone ? "✓" : s.emoji}
                      </div>
                      <p
                        className={`text-[9px] font-black ${s.labelCls} uppercase tracking-widest`}
                      >
                        {s.name}
                      </p>
                      {isDone && (
                        <span className="ml-auto text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] font-black leading-snug ${isDone ? "text-emerald-700" : "text-gray-800"}`}
                    >
                      {title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                    {/* mini pct bar */}
                    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${isDone ? "bg-emerald-400" : isGood ? "bg-emerald-300" : "bg-red-300"}`}
                        style={{ width: `${Math.min(s.pct, 100)}%` }}
                      />
                    </div>
                    <p
                      className={`text-[9px] font-black mt-0.5 ${isDone ? "text-emerald-600" : isGood ? "text-emerald-500" : "text-red-400"}`}
                    >
                      {s.pct}% of goal
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Status pills — fully dynamic */}
            <div className="flex flex-wrap gap-1.5">
              {macroStatuses.map((s) => (
                <span
                  key={s.name}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${s.cls}`}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly calorie chart */}
      <div className="card p-0 overflow-hidden relative border border-blue-50 shadow-md hover:shadow-lg transition-shadow duration-300">
        {/* Gradient background mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-white to-violet-50/40 pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-blue-400/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-violet-400/8 blur-3xl pointer-events-none" />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-blue-100 shadow-sm">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 tracking-tight">
                  Weekly Nutrition Trend
                </h2>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  Energy intake across the week
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {weeklyInsights.hasData && (
                <div
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all duration-300 ${weeklyInsights.status.color}`}
                >
                  {weeklyInsights.status.label}
                </div>
              )}
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                This Week •{" "}
                <span className="text-blue-600 font-black">
                  {weeklyInsights.total.toLocaleString()}
                </span>{" "}
                kcal
              </p>
            </div>
          </div>

          {/* Quick stat chips — shown only when data exists */}
          {weeklyInsights.hasData && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Total
                </span>
                <span className="text-[10px] font-black text-blue-600">
                  {weeklyInsights.total.toLocaleString()} kcal
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Daily Avg
                </span>
                <span className="text-[10px] font-black text-violet-600">
                  {weeklyInsights.average.toLocaleString()} kcal
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Best
                </span>
                <span className="text-[10px] font-black text-gray-700">
                  {weeklyInsights.maxDay.day}
                </span>
                <span className="text-[10px] font-black text-emerald-600">
                  {weeklyInsights.maxDay.calories.toLocaleString()} kcal
                </span>
              </div>
            </div>
          )}

          {/* Chart area */}
          <div className="rounded-2xl bg-white/70 border border-gray-100/80 shadow-sm p-4">
            {!weeklyInsights.hasData ? (
              <div className="relative h-[190px] w-full flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-50/60 to-white/40 border border-slate-100 group/empty transition-all duration-300 hover:border-blue-200/50 hover:shadow-md">
                {/* Ghost bars */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none px-4 pt-6 group-hover/empty:opacity-[0.06] transition-opacity duration-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={placeholderData}>
                      <Bar
                        dataKey="calories"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-blue-400/6 blur-[60px] rounded-full pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center text-center px-6 gap-3">
                  <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-sm text-slate-600 font-bold max-w-[260px] leading-relaxed">
                    Track meals to unlock your weekly nutrition insights 📊
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-300 hover:bg-blue-700 hover:shadow-lg active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log your first meal
                  </button>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -28, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="barGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop
                        offset="100%"
                        stopColor="#60a5fa"
                        stopOpacity={0.65}
                      />
                    </linearGradient>
                    <linearGradient
                      id="todayGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#1d4ed8" stopOpacity={1} />
                      <stop
                        offset="100%"
                        stopColor="#2563eb"
                        stopOpacity={0.85}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#F1F5F9"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fontWeight: 700, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 600, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[
                      0,
                      (dataMax: number) =>
                        Math.max(
                          calorieGoal * 1.4,
                          Math.ceil(dataMax / 500) * 500,
                        ),
                    ]}
                  />
                  <Tooltip
                    cursor={{ fill: "#EFF6FF", radius: 6 }}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #DBEAFE",
                      boxShadow: "0 10px 25px -5px rgba(37,99,235,0.12)",
                      padding: "10px 14px",
                      backgroundColor: "#FFFFFF",
                    }}
                    itemStyle={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#1E293B",
                    }}
                    labelStyle={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#64748B",
                      marginBottom: 4,
                    }}
                    animationDuration={200}
                  />
                  <Bar
                    dataKey="calories"
                    radius={[7, 7, 0, 0]}
                    name="Calories"
                    animationBegin={150}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {chartData.map((entry, index) => {
                      const isToday = index === new Date().getDay();
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            isToday
                              ? "url(#todayGradient)"
                              : "url(#barGradient)"
                          }
                          style={{ transformOrigin: "bottom" }}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Stats cards */}
          {weeklyInsights.hasData && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {/* Weekly Total */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 hover:bg-blue-50 transition-colors duration-200">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">
                  Weekly Total
                </p>
                <p className="text-2xl font-black text-gray-900 leading-none">
                  {weeklyInsights.total.toLocaleString()}
                </p>
                <p className="text-[10px] text-blue-500 font-bold mt-1">
                  kcal tracked
                </p>
              </div>

              {/* Daily Average */}
              <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-100 hover:bg-violet-50 transition-colors duration-200">
                <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1">
                  Daily Average
                </p>
                <p className="text-2xl font-black text-gray-900 leading-none">
                  {weeklyInsights.average.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-[10px] text-violet-500 font-bold">
                    kcal / day
                  </p>
                  <span className="text-[9px] text-gray-400 font-medium">
                    vs {calorieGoal.toLocaleString()} goal
                  </span>
                </div>
              </div>

              {/* Highest Day */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 hover:bg-emerald-50 transition-colors duration-200">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                  Highest Day
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-lg shrink-0">
                    {weeklyInsights.maxDay.day}
                  </span>
                  <p className="text-2xl font-black text-gray-900 leading-none">
                    {weeklyInsights.maxDay.calories.toLocaleString()}
                  </p>
                </div>
                <p className="text-[10px] text-emerald-500 font-bold mt-1">
                  kcal consumed
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meals log + suggestions */}
      <div className="grid grid-cols-2 gap-4">
        {/* Today's Meals Card */}
        <div className="card p-0 overflow-hidden relative border border-green-50 shadow-md hover:shadow-lg transition-shadow duration-300">
          {/* Gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-white to-blue-50/30 pointer-events-none" />
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-green-400/8 blur-2xl pointer-events-none" />

          <div className="relative z-10 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-white border border-green-100 shadow-sm">
                  <Apple className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">
                    Today's Meals
                  </h2>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    {todayMeals.length > 0
                      ? `${todayMeals.length} meal${todayMeals.length > 1 ? "s" : ""} logged · ${totalCalories.toLocaleString()} kcal`
                      : "No meals logged yet"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMealType(getDefaultMealType());
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 hover:bg-blue-700 hover:shadow-lg active:scale-95 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Meal
              </button>
            </div>

            {/* Meal list */}
            <div className="space-y-2.5">
              {todayMeals.length > 0 ? (
                todayMeals.map((meal) => {
                  const mealCfg: Record<
                    string,
                    {
                      borderColor: string;
                      badgeCls: string;
                      kcalCls: string;
                      emoji: string;
                    }
                  > = {
                    Breakfast: {
                      borderColor: "#f59e0b",
                      badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
                      kcalCls: "bg-amber-50 text-amber-700 border-amber-200",
                      emoji: "🌅",
                    },
                    Lunch: {
                      borderColor: "#3b82f6",
                      badgeCls: "bg-blue-50 text-blue-700 border-blue-200",
                      kcalCls: "bg-blue-50 text-blue-700 border-blue-200",
                      emoji: "☀️",
                    },
                    Dinner: {
                      borderColor: "#6366f1",
                      badgeCls:
                        "bg-indigo-50 text-indigo-700 border-indigo-200",
                      kcalCls: "bg-indigo-50 text-indigo-700 border-indigo-200",
                      emoji: "🌙",
                    },
                    Snack: {
                      borderColor: "#10b981",
                      badgeCls:
                        "bg-emerald-50 text-emerald-700 border-emerald-200",
                      kcalCls:
                        "bg-emerald-50 text-emerald-700 border-emerald-200",
                      emoji: "🍎",
                    },
                  };
                  const cfg = mealCfg[meal.meal_type] ?? {
                    borderColor: "#94a3b8",
                    badgeCls: "bg-gray-50 text-gray-600 border-gray-200",
                    kcalCls: "bg-gray-50 text-gray-600 border-gray-200",
                    emoji: "🍽️",
                  };
                  const calPortion =
                    calorieGoal > 0
                      ? Math.min(
                          100,
                          Math.round((meal.calories / calorieGoal) * 100),
                        )
                      : 0;

                  return (
                    <div
                      key={meal.id}
                      className="rounded-2xl border border-gray-100 bg-white overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-200 group/meal"
                      style={{
                        borderLeftColor: cfg.borderColor,
                        borderLeftWidth: "3px",
                      }}
                    >
                      <div className="p-3.5">
                        {/* Top: badge + time */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm leading-none">
                              {cfg.emoji}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.badgeCls}`}
                            >
                              {meal.meal_type}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black text-gray-400 bg-gray-50 border border-gray-100">
                            {format(parseISO(meal.created_at), "hh:mm a")}
                          </span>
                        </div>

                        {/* Food name */}
                        <p className="text-xs text-gray-600 font-medium leading-snug line-clamp-2">
                          {meal.food_name}
                        </p>

                        {/* Bottom: mini bar + kcal */}
                        {meal.calories > 0 && (
                          <div className="flex items-center justify-between mt-2.5 gap-3">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${calPortion}%`,
                                    backgroundColor: cfg.borderColor,
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-400 font-medium shrink-0">
                                {calPortion}% of goal
                              </span>
                            </div>
                            <span
                              className={`text-[11px] font-black px-2.5 py-0.5 rounded-xl border shrink-0 ${cfg.kcalCls}`}
                            >
                              {meal.calories} kcal
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="space-y-3">
                  {/* Ghost slots */}
                  <div className="grid grid-cols-2 gap-2">
                    {["Breakfast", "Lunch", "Dinner", "Snack"].map((slot) => {
                      const locked = isMealLocked(slot);
                      return (
                        <button
                          key={slot}
                          disabled={locked}
                          onClick={() => {
                            if (locked) return;
                            setMealType(slot);
                            setIsModalOpen(true);
                          }}
                          className={`p-3 rounded-xl border flex flex-col gap-1.5 text-left transition-all duration-200 ${
                            locked
                              ? "border-emerald-100 bg-emerald-50/60 cursor-not-allowed opacity-80"
                              : "border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-100 hover:shadow-sm opacity-50 hover:opacity-100 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest ${locked ? "text-emerald-600" : "text-gray-400"}`}
                            >
                              {slot}
                            </span>
                            {locked && (
                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                ✓ Done
                              </span>
                            )}
                          </div>
                          <div
                            className={`h-1 w-8 rounded-full ${locked ? "bg-emerald-300" : "bg-gray-200"}`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col items-center justify-center text-center py-5 bg-gray-50/40 rounded-2xl border border-dashed border-gray-100">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 mb-3">
                      <Apple className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-black text-gray-600 mb-1">
                      No meals logged yet
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium max-w-[180px] leading-relaxed mb-3">
                      Start tracking to build your daily nutrition profile
                    </p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all hover:bg-blue-700 active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                      Log first meal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Food Suggestions — redesigned */}
        <div className="card p-0 overflow-hidden relative border border-violet-50 shadow-md hover:shadow-lg transition-shadow duration-300">
          {/* Gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/40 via-white to-emerald-50/30 pointer-events-none" />
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-violet-400/8 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-emerald-400/8 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-white border border-violet-100 shadow-sm">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">
                    AI Food Suggestions
                  </h2>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    Personalized based on your nutrition gaps
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest">
                  AI Powered
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-2.5">
              {suggestions.length > 0 ? (
                <>
                  {suggestions.map((item, index) => {
                    const colorMap = [
                      {
                        border: "#10b981",
                        badgeCls: "bg-emerald-100 text-emerald-700",
                        hoverBorder: "hover:border-emerald-200",
                        dot: "bg-emerald-400",
                      },
                      {
                        border: "#3b82f6",
                        badgeCls: "bg-blue-100 text-blue-700",
                        hoverBorder: "hover:border-blue-200",
                        dot: "bg-blue-400",
                      },
                      {
                        border: "#8b5cf6",
                        badgeCls: "bg-violet-100 text-violet-700",
                        hoverBorder: "hover:border-violet-200",
                        dot: "bg-violet-400",
                      },
                      {
                        border: "#f59e0b",
                        badgeCls: "bg-amber-100 text-amber-700",
                        hoverBorder: "hover:border-amber-200",
                        dot: "bg-amber-400",
                      },
                      {
                        border: "#ec4899",
                        badgeCls: "bg-pink-100 text-pink-700",
                        hoverBorder: "hover:border-pink-200",
                        dot: "bg-pink-400",
                      },
                    ];
                    const c = colorMap[index % colorMap.length];
                    return (
                      <div
                        key={index}
                        className={`rounded-2xl border border-gray-100 bg-white overflow-hidden transition-all duration-200 hover:shadow-md ${c.hoverBorder} group/item`}
                        style={{
                          borderLeftColor: c.border,
                          borderLeftWidth: "3px",
                        }}
                      >
                        <div className="p-3.5">
                          <div className="flex items-start gap-3">
                            {/* Number badge */}
                            <div
                              className={`w-6 h-6 rounded-lg ${c.badgeCls} flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5`}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-black text-gray-900 leading-snug mb-1">
                                {item.title}
                              </h4>
                              <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                                {item.reason}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Insight panel */}
                  {insight && (
                    <div className="mt-1 p-4 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-start gap-3">
                      <div className="p-1.5 rounded-xl bg-white shadow-sm text-blue-600 shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">
                          Nutritional Intelligence
                        </p>
                        <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                          {insight}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  {/* Ghost skeleton cards */}
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-gray-50 bg-gray-50/60 p-3.5"
                      style={{ opacity: 1 - i * 0.2 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div
                            className="h-3 bg-gray-100 rounded-full"
                            style={{ width: `${70 - i * 10}%` }}
                          />
                          <div className="h-2 bg-gray-50 rounded-full w-full" />
                          <div
                            className="h-2 bg-gray-50 rounded-full"
                            style={{ width: `${85 - i * 8}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* CTA */}
                  <div className="flex flex-col items-center justify-center text-center py-4 gap-3 rounded-2xl border border-dashed border-violet-100 bg-violet-50/30">
                    <div className="p-2.5 rounded-2xl bg-white border border-violet-100 shadow-sm">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-700">
                        No AI suggestions yet
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1 max-w-[180px] mx-auto leading-relaxed">
                        Log your meals to get personalized food recommendations
                      </p>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all hover:bg-violet-700 hover:shadow-lg active:scale-95 shadow-md"
                    >
                      <Plus className="w-3 h-3" />
                      Log Meal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Meal Modal - AI Guided UX */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
          isModalOpen
            ? "opacity-100 pointer-events-auto bg-black/35 backdrop-blur-md"
            : "opacity-0 pointer-events-none bg-black/0 backdrop-blur-0"
        }`}
      >
        <div
          className={`w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white via-blue-50/40 to-white shadow-[0_30px_90px_-35px_rgba(37,99,235,0.45)] transition-all duration-300 ${
            isModalOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-blue-50/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-base tracking-tight">
                  ✨ Let&apos;s understand your meal
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Tell me what you had — I&apos;ll break it down for you
                </p>
                <p className="text-[10px] text-blue-500/90 font-medium mt-1">
                  {step === 1
                    ? "Step 1 — Tell me your meal"
                    : step === 2
                      ? "Step 2 — Quick details"
                      : "Step 3 — Nutrition preview"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {/* Step 1: Basic Input */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Meal Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Breakfast", icon: "🌅" },
                      { label: "Lunch", icon: "🌞" },
                      { label: "Dinner", icon: "🌙" },
                      { label: "Snack", icon: "🍿" },
                    ].map(({ label, icon }) => {
                      const type = label;
                      const selected = mealType === type;
                      const locked = isMealLocked(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            if (locked) {
                              toast.error(
                                `You've already logged ${type} today! Each main meal can only be logged once.`,
                              );
                              return;
                            }
                            setMealType(type);
                          }}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ease-out relative ${
                            locked
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed"
                              : selected
                                ? "bg-blue-600 text-white shadow-[0_12px_28px_-12px_rgba(37,99,235,0.95)] ring-1 ring-blue-300 ring-offset-2 ring-offset-white hover:scale-[1.02]"
                                : "bg-white/90 text-gray-600 border border-gray-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_-16px_rgba(15,23,42,0.45)] hover:border-blue-200 hover:scale-[1.02]"
                          }`}
                        >
                          <span className="inline-flex items-center justify-between w-full gap-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{locked ? "✓" : icon}</span>
                              <span>{type}</span>
                            </span>
                            {locked && (
                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                                Logged
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    What did you eat?
                  </label>
                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder=""
                      className="w-full p-4 h-32 rounded-2xl border border-transparent bg-slate-100/70 text-sm font-medium resize-none mb-2 text-gray-800 placeholder-transparent transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(59,130,246,0.14)]"
                    />
                    {!description && (
                      <div className="pointer-events-none absolute left-4 top-4 text-sm text-gray-400">
                        <span className="absolute left-0 top-0 meal-placeholder-line meal-placeholder-delay-0">
                          Dal + 2 roti + sabzi
                        </span>
                        <span className="absolute left-0 top-0 meal-placeholder-line meal-placeholder-delay-1">
                          Eggs + toast
                        </span>
                        <span className="absolute left-0 top-0 meal-placeholder-line meal-placeholder-delay-2">
                          Rice + curry
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-600/90 font-medium mb-3">
                    This looks like a balanced meal
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {["+ Add quantity", "+ Add oil info", "+ Add sugar"].map(
                      (chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[11px] font-medium text-gray-600 border border-gray-200 bg-white/90 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                        >
                          {chip}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    onClick={handleImproveMeal}
                    disabled={loading || !description}
                    className="meal-analyze-btn w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:scale-[1.03] hover:shadow-[0_20px_36px_-16px_rgba(37,99,235,0.78)] active:scale-[0.98] transition-all duration-300 disabled:bg-gray-300 disabled:hover:scale-100 disabled:shadow-none"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {loading ? "Improving..." : "⚡ Analyze & Improve"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Improved Text & Questions */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">
                    Improved Description:
                  </p>
                  <p className="text-sm text-blue-900 font-medium">
                    {improvedText}
                  </p>
                </div>

                {questions.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Quick Details:
                    </p>
                    {questions.map((q) => (
                      <div key={q.key} className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700">
                          {q.question}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt: string) => (
                            <button
                              key={opt}
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.key]: opt,
                                }))
                              }
                              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                answers[q.key] === opt
                                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleAnalyzeMeal}
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Next"
                  )}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Step 3: Nutrition Preview */}
            {step === 3 && preview && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase mb-4 text-center tracking-widest">
                    Nutrition Preview
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "Cal", val: preview.calories, unit: "" },
                      { label: "Prot", val: preview.protein, unit: "g" },
                      { label: "Carb", val: preview.carbs, unit: "g" },
                      { label: "Fat", val: preview.fat, unit: "g" },
                      { label: "Fiber", val: preview.fiber, unit: "g" },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <p className="text-[10px] text-emerald-600 font-bold mb-1">
                          {item.label}
                        </p>
                        <p className="text-sm font-bold text-emerald-900">
                          {item.val}
                          {item.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleLogMeal}
                  disabled={isSaving}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Meal Log"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
