import { useState, useEffect, useMemo } from "react";
import { Droplets, Moon, Smile, Plus, Minus, BarChart2, Loader2, CheckCircle2, Coffee, GlassWater, UtilityPole as Bottle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { createAlert } from "@/lib/alerts";

const moods = ["😟", "😕", "😐", "🙂", "😊"];
const moodLabels = ["Poor", "Low", "Okay", "Good", "Great"];

interface LogHistoryItem {
  date: string;
  dateStr: string;
  water: number | string;
  sleep: number | string;
  mood: string;
  symptoms: string[];
}

interface TimelineEntry {
  id: string;
  type: "water" | "sleep" | "mood" | "symptom";
  time: string;
  timestamp: string;
  detail: string;
}

function Slider({ label, value, max, unit, color, onChange }: { label: string; value: number; max: number; unit: string; color: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold text-gray-900">{value}{unit}</span>
      </div>
      <input type="range" min={0} max={max} step={max > 10 ? 0.1 : 1} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: color }} />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>0</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function DailyLogs() {
  const { user } = useAuth();
  const [totalWater, setTotalWater] = useState(0); 
  const [waterInput, setWaterInput] = useState(0); 
  const [sleepHrs, setSleepHrs] = useState(8);
  const [bedtime, setBedtime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");

  useEffect(() => {
    if (!bedtime || !wakeTime) return;
    
    const [bH, bM] = bedtime.split(":").map(Number);
    const [wH, wM] = wakeTime.split(":").map(Number);
    
    // Create Date objects for calculation
    const start = new Date(0, 0, 0, bH, bM);
    const end = new Date(0, 0, 0, wH, wM);
    
    let diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 0) {
      // Crosses midnight
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    const totalHours = diffMs / (1000 * 60 * 60);
    setSleepHrs(Number(totalHours.toFixed(1)));
  }, [bedtime, wakeTime]);

  const [mood, setMood] = useState(2);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<LogHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<TimelineEntry[]>([]);
  const [todayStats, setTodayStats] = useState<{
    water: number;
    sleep: number;
    mood: string;
    symptoms: string[];
  }>({
    water: 0,
    sleep: 0,
    mood: "-",
    symptoms: []
  });

  const healthScore = useMemo(() => {
    let score = 100;
    const totalW = todayStats.water;
    const sHrs = todayStats.sleep;
    const mLabel = todayStats.mood;
    const sCount = todayStats.symptoms.length;

    // Hydration
    if (totalW >= 2) {
      // 0 deduction
    } else if (totalW >= 1.5) {
      score -= 5;
    } else if (totalW >= 1) {
      score -= 10;
    } else if (totalW > 0) {
      score -= 20;
    }

    // Sleep
    if (sHrs >= 7) {
      // 0 deduction for 7+ hours
    } else if (sHrs >= 6) {
      score -= 5;
    } else if (sHrs >= 5) {
      score -= 10;
    } else if (sHrs > 0) {
      score -= 20;
    }

    // Mood
    if (mLabel === "Great" || mLabel === "Good") {
      // 0 deduction
    } else if (mLabel === "Okay") {
      score -= 5;
    } else if (mLabel !== "-") {
      score -= 10;
    }

    // Symptoms
    if (sCount === 0) {
      // 0 deduction
    } else if (sCount === 1) {
      score -= 5;
    } else if (sCount === 2) {
      score -= 10;
    } else if (sCount >= 3) {
      score -= 20;
    }

    const clampedScore = Math.max(0, Math.min(100, score));
    
    let status = "Excellent";
    let color = "text-emerald-600";
    let finalInsight = "";

    if (clampedScore >= 85) { 
      status = "Excellent"; 
      color = "text-emerald-600"; 
      finalInsight = "You're maintaining a very healthy routine. Keep it up.";
    } else if (clampedScore >= 70) { 
      status = "Good"; 
      color = "text-blue-600"; 
      finalInsight = "Your routine is mostly balanced with minor areas to improve.";
    } else if (clampedScore >= 50) { 
      status = "Moderate"; 
      color = "text-amber-600"; 
      finalInsight = "Some areas need attention, consider improving hydration or rest.";
    } else { 
      status = "Needs Attention"; 
      color = "text-red-600"; 
      finalInsight = "Multiple factors need attention, monitor closely.";
    }

    if (totalW === 0 && sHrs === 0 && mLabel === "-" && sCount === 0) {
      finalInsight = "Start logging to see your score";
    }

    return { score: clampedScore, status, insight: finalInsight, color };
  }, [todayStats]);

  const streakCount = useMemo(() => {
    if (history.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Simple streak calculation from history
    for (let i = 0; i < history.length; i++) {
      const logDate = new Date(history[i].dateStr);
      logDate.setHours(0, 0, 0, 0);
      
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      
      if (logDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (i === 0) {
        // If no log today, streak might still be alive if there was a log yesterday
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (logDate.getTime() === yesterday.getTime()) {
          // Streak alive, but don't increment for today yet
          continue;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return streak;
  }, [history]);

  const aiGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = user?.user_metadata?.full_name?.split(" ")[0] || "there";
    let greeting = "";
    
    if (hour < 12) greeting = `Good morning, ${name}!`;
    else if (hour < 17) greeting = `Good afternoon, ${name}!`;
    else greeting = `Good evening, ${name}!`;
    
    if (healthScore.score >= 85) return `${greeting} You're doing amazing today! ✨`;
    if (healthScore.score >= 70) return `${greeting} You're on the right track.`;
    return `${greeting} Let's focus on some self-care.`;
  }, [user, healthScore]);

  const dailyAffirmation = useMemo(() => {
    const affirmations = [
      "Your body is doing incredible work today.",
      "Every drop of water is a gift to your baby.",
      "Rest is not a luxury, it's a necessity.",
      "You are strong, capable, and doing great.",
      "Listen to your body; it knows what it needs."
    ];
    // Seeded random based on date
    const day = new Date().getDate();
    return affirmations[day % affirmations.length];
  }, []);

  const completionCount = useMemo(() => {
    let count = 0;
    if (totalWater + waterInput > 0) count++;
    if (sleepHrs > 0) count++;
    if (mood !== -1) count++;
    if (symptoms.length > 0) count++;
    return count;
  }, [totalWater, waterInput, sleepHrs, mood, symptoms]);

  const waterFeedback = useMemo(() => {
    const total = totalWater + waterInput;
    if (total === 0) return "Not started";
    if (total >= 2.5) return "Goal reached!";
    if (total >= 1.5) return "Almost there";
    return "Keep drinking!";
  }, [totalWater, waterInput]);

  const sleepFeedback = useMemo(() => {
    if (sleepHrs >= 8) return "Perfect rest";
    if (sleepHrs >= 6) return "Good sleep";
    return "Rest more";
  }, [sleepHrs]);

  const moodFeedback = useMemo(() => {
    if (mood >= 3) return "Feeling great";
    if (mood === 2) return "Doing okay";
    return "Sending support";
  }, [mood]);

  const allSymptoms = ["Fatigue", "Back Pain", "Heartburn", "Swelling", "Nausea", "Headache", "Insomnia", "Shortness of Breath"];

  const fetchTodayData = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    try {
      const [waterRes, sleepRes, moodRes, symptomsRes] = await Promise.all([
        supabase.from("water_intake").select("amount_liters").eq("user_id", user.id).gte("recorded_at", startOfDay).lte("recorded_at", endOfDay),
        supabase.from("sleep_data").select("sleep_hours").eq("user_id", user.id).gte("recorded_at", startOfDay).lte("recorded_at", endOfDay),
        supabase.from("mood_logs").select("mood").eq("user_id", user.id).gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false }).limit(1),
        supabase.from("symptoms").select("symptom").eq("user_id", user.id).gte("recorded_at", startOfDay).lte("recorded_at", endOfDay)
      ]);

      const totalW = (waterRes.data || []).reduce((sum, row) => sum + Number(row.amount_liters || 0), 0);
      const totalS = (sleepRes.data || []).reduce((sum, row) => sum + Number(row.sleep_hours || 0), 0);
      const latestM = moodRes.data?.[0]?.mood || "-";
      const uniqueSyms = Array.from(new Set((symptomsRes.data || []).map(s => s.symptom).filter(Boolean)));

      setTodayStats({
        water: Number(totalW.toFixed(1)),
        sleep: Number(totalS.toFixed(1)),
        mood: latestM,
        symptoms: uniqueSyms
      });
      
      // Update totalWater state as well for UI consistency
      setTotalWater(Number(totalW.toFixed(1)));
    } catch (err) {
      console.error("Error fetching today's health data:", err);
    }
  };

  const fetchHistory = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setIsLoadingHistory(true);
    const userId = userData.user.id;

    try {
      const [waterRes, sleepRes, moodRes, symptomsRes] = await Promise.all([
        supabase.from("water_intake").select("amount_liters, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(50),
        supabase.from("sleep_data").select("sleep_hours, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(50),
        supabase.from("mood_logs").select("mood, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("symptoms").select("symptom, recorded_at").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(50)
      ]);

      const mergedData: Record<string, { dateObj: Date; water: number; sleep: number; mood: string; symptoms: string[] }> = {};

      waterRes.data?.forEach((item: { recorded_at: string; amount_liters: number }) => {
        const dateStr = format(new Date(item.recorded_at), "yyyy-MM-dd");
        if (!mergedData[dateStr]) mergedData[dateStr] = { dateObj: new Date(item.recorded_at), water: 0, sleep: 0, mood: "-", symptoms: [] };
        mergedData[dateStr].water += item.amount_liters;
      });

      sleepRes.data?.forEach((item: { recorded_at: string; sleep_hours: number }) => {
        const dateStr = format(new Date(item.recorded_at), "yyyy-MM-dd");
        if (!mergedData[dateStr]) mergedData[dateStr] = { dateObj: new Date(item.recorded_at), water: 0, sleep: 0, mood: "-", symptoms: [] };
        mergedData[dateStr].sleep += item.sleep_hours;
      });

      moodRes.data?.forEach((item: { created_at: string; mood: string }) => {
        const dateStr = format(new Date(item.created_at), "yyyy-MM-dd");
        if (!mergedData[dateStr]) mergedData[dateStr] = { dateObj: new Date(item.created_at), water: 0, sleep: 0, mood: "-", symptoms: [] };
        if (mergedData[dateStr].mood === "-") {
          mergedData[dateStr].mood = item.mood;
        }
      });

      symptomsRes.data?.forEach((item: { symptom: string; recorded_at: string }) => {
        if (!item.symptom || item.symptom.trim() === "") return;
        const dateStr = format(new Date(item.recorded_at), "yyyy-MM-dd");
        if (!mergedData[dateStr]) mergedData[dateStr] = { dateObj: new Date(item.recorded_at), water: 0, sleep: 0, mood: "-", symptoms: [] };
        if (!mergedData[dateStr].symptoms.includes(item.symptom)) {
          mergedData[dateStr].symptoms.push(item.symptom);
        }
      });

      const sortedHistory = Object.keys(mergedData)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 10)
        .map(dateStr => {
          const item = mergedData[dateStr];
          return {
            date: format(item.dateObj, "MMM d"),
            dateStr,
            water: item.water > 0 ? item.water : "-",
            sleep: item.sleep > 0 ? item.sleep : "-",
            mood: item.mood,
            symptoms: item.symptoms
          };
        });

      setHistory(sortedHistory);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchDayDetails = async (dateStr: string) => {
    if (!user) return;
    setDayDetails([]);

    try {
      const startOfDay = `${dateStr}T00:00:00.000Z`;
      const endOfDay = `${dateStr}T23:59:59.999Z`;

      const [waterRes, sleepRes, moodRes, symptomsRes] = await Promise.all([
        supabase.from("water_intake").select("*").eq("user_id", user.id).gte("recorded_at", startOfDay).lte("recorded_at", endOfDay),
        supabase.from("sleep_data").select("*").eq("user_id", user.id).gte("recorded_at", startOfDay).lte("recorded_at", endOfDay),
        supabase.from("mood_logs").select("*").eq("user_id", user.id).gte("created_at", startOfDay).lte("created_at", endOfDay),
        supabase.from("symptoms").select("*").eq("user_id", user.id).gte("recorded_at", startOfDay).lte("recorded_at", endOfDay)
      ]);

      const timeline: TimelineEntry[] = [];

      waterRes.data?.forEach((item: { id: string; recorded_at: string; amount_liters: number }) => {
        timeline.push({
          id: `w-${item.id}`,
          type: "water",
          time: format(new Date(item.recorded_at), "h:mm a"),
          timestamp: item.recorded_at,
          detail: `Water (${item.amount_liters}L)`
        });
      });

      sleepRes.data?.forEach((item: { id: string; recorded_at: string; sleep_hours: number }) => {
        timeline.push({
          id: `s-${item.id}`,
          type: "sleep",
          time: format(new Date(item.recorded_at), "h:mm a"),
          timestamp: item.recorded_at,
          detail: `Sleep (${item.sleep_hours}h)`
        });
      });

      moodRes.data?.forEach((item: { id: string; created_at: string; mood: string }) => {
        timeline.push({
          id: `m-${item.id}`,
          type: "mood",
          time: format(new Date(item.created_at), "h:mm a"),
          timestamp: item.created_at,
          detail: `Mood (${item.mood})`
        });
      });

      symptomsRes.data?.forEach((item: { id: string; recorded_at: string; symptom: string }) => {
        if (!item.symptom || item.symptom.trim() === "") return;
        timeline.push({
          id: `sym-${item.id}`,
          type: "symptom",
          time: format(new Date(item.recorded_at), "h:mm a"),
          timestamp: item.recorded_at,
          detail: `Symptom (${item.symptom})`
        });
      });

      setDayDetails(timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    } catch (error) {
      console.error("Error fetching day details:", error);
    }
  };

  const toggleExpand = (dateStr: string) => {
    if (expandedDate === dateStr) {
      setExpandedDate(null);
    } else {
      setExpandedDate(dateStr);
      fetchDayDetails(dateStr);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchTodayData();
  }, [user]);

  async function saveWaterIntake(userId: string, waterValue: number) {
    const { error } = await supabase
      .from("water_intake")
      .insert([
        {
          user_id: userId,
          amount_liters: Number(waterValue),
          source: "Manual Log",
          recorded_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error("WATER SAVE ERROR:", error);
      return false;
    }
    return true;
  }

  const handleSave = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      toast.error("You must be logged in to save logs.");
      return;
    }

    setIsSaving(true);
    const userId = userData.user.id;
    const now = new Date().toISOString();

    try {
      // 1. Water intake: Insert only new incremental input
      if (waterInput > 0) {
        await saveWaterIntake(userId, waterInput);
      }

      // 2. Sleep data: Only log if > 0 and validate limit (max 2/day)
      if (sleepHrs > 0) {
        try {
          const today_date = new Date().toISOString().split("T")[0];
          const { data: todaySleep } = await supabase
            .from("sleep_data")
            .select("id")
            .eq("user_id", userId)
            .gte("recorded_at", `${today_date}T00:00:00`)
            .lte("recorded_at", `${today_date}T23:59:59`);

          if (todaySleep && todaySleep.length >= 2) {
            toast.error("You can only log sleep twice per day");
          } else {
            const sleepPayload = {
              user_id: userId,
              sleep_hours: sleepHrs,
              recorded_at: now,
            };
            await supabase.from("sleep_data").insert(sleepPayload);
          }
        } catch (err) {
          console.error("Sleep log failed:", err);
        }
      }

      // 3. Mood logs
      try {
        const moodPayload = {
          user_id: userId,
          mood: moodLabels[mood],
          created_at: now,
        };
        await supabase.from("mood_logs").insert(moodPayload);
      } catch (err) {
        console.error("Mood log failed:", err);
      }

      // 4. Symptoms: Insert one row per symptom
      // Requirement 3: Only allow symptoms explicitly selected by user and ignore empty/null
      const validSymptoms = symptoms.filter(s => s && s.trim() !== "");
      if (validSymptoms.length > 0) {
        for (const symptomName of validSymptoms) {
          try {
            const symptomPayload = {
              user_id: userId,
              symptom: symptomName,
              severity: 1,
              recorded_at: now,
            };
            const { error } = await supabase.from("symptoms").insert(symptomPayload);
            if (!error) {
              // Trigger alerts ONLY when health score is < 50
              const alertSymptoms = ["Shortness of Breath", "Nausea", "Headache", "Swelling"];
              if (alertSymptoms.includes(symptomName) && healthScore.score < 50) {
                await createAlert({
                  user_id: userId,
                  title: `Reported Symptom: ${symptomName}`,
                  description: `You have reported ${symptomName}. Based on your current health score (${healthScore.score}), please monitor and consult your provider if it persists.`,
                  severity: "warning",
                  type: `Symptom:${symptomName}`,
                });
              }
            }
          } catch (err) {
            console.error(`Symptom log failed for ${symptomName}:`, err);
          }
        }
      }

      toast.success("Daily logs saved successfully!");
      setWaterInput(0); 
      await fetchHistory(); 
      await fetchTodayData(); 
    } catch (error: any) {
      console.error("Error saving logs:", error.message);
      toast.error("Failed to save logs. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200"
          >
            <CheckCircle2 className="w-6 h-6" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{aiGreeting}</h1>
            <p className="text-sm font-medium text-gray-500">{dailyAffirmation}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {streakCount > 0 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-50 border border-orange-100 shadow-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-xl">🔥</span>
              </motion.div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-orange-600 uppercase tracking-widest leading-none">{streakCount} Day</span>
                <span className="text-[9px] font-bold text-orange-400 uppercase tracking-tighter">Streak</span>
              </div>
            </motion.div>
          )}
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]" 
                  initial={{ width: 0 }}
                  animate={{ width: `${(completionCount / 4) * 100}%` }}
                  transition={{ type: "spring", stiffness: 50 }}
                />
              </div>
              <span className="text-sm font-black text-blue-600 tabular-nums">{completionCount}/4</span>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
            animate={completionCount === 4 ? { 
              boxShadow: ["0 0 0px rgba(37,99,235,0)", "0 0 20px rgba(37,99,235,0.4)", "0 0 0px rgba(37,99,235,0)"] 
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            onClick={handleSave}
            disabled={isSaving}
            className={`action-btn flex items-center gap-2 px-8 py-3.5 shadow-xl transition-all duration-500 ${
              completionCount === 4 ? 'bg-blue-600 shadow-blue-500/40' : 'bg-gray-400 shadow-gray-500/10'
            }`}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? "Saving..." : completionCount === 4 ? "Complete Daily Log" : "Save Today's Log"}
          </motion.button>
        </div>
      </div>

      {/* Health Score Card */}
      <motion.div 
        layout
        className="card p-6 relative overflow-hidden group min-h-[140px]"
      >
        {/* Animated Mesh Gradient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          <motion.div 
            className={`absolute -top-1/2 -left-1/2 w-[200%] h-[200%] rounded-[40%] mix-blend-multiply filter blur-3xl opacity-30 ${
              healthScore.score >= 85 ? 'bg-emerald-400' :
              healthScore.score >= 70 ? 'bg-blue-400' :
              healthScore.score >= 50 ? 'bg-amber-400' :
              'bg-red-400'
            }`}
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1],
              x: [0, 50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-20 h-20 rounded-[2rem] bg-white/80 backdrop-blur-md shadow-xl border border-white flex flex-col items-center justify-center relative overflow-hidden"
            >
              <div className={`absolute inset-0 opacity-10 ${
                healthScore.score >= 85 ? 'bg-emerald-500' :
                healthScore.score >= 70 ? 'bg-blue-500' :
                healthScore.score >= 50 ? 'bg-amber-500' :
                'bg-red-500'
              }`} />
              <span className={`text-3xl font-black ${healthScore.color} drop-shadow-sm`}>{healthScore.score}</span>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Health Score</span>
            </motion.div>
            
            <div className="space-y-1">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Live Vital Analysis</h2>
              <div className="flex items-center gap-3">
                <motion.span 
                  key={healthScore.status}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-2xl font-black ${healthScore.color}`}
                >
                  {healthScore.status}
                </motion.span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                <p className="text-base text-gray-700 font-bold tracking-tight">{healthScore.insight}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="h-4 w-64 bg-gray-100 rounded-full overflow-hidden p-1 shadow-inner backdrop-blur-sm">
              <motion.div 
                className={`h-full rounded-full relative ${
                  healthScore.score >= 85 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                  healthScore.score >= 70 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                  healthScore.score >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                  'bg-gradient-to-r from-red-400 to-red-600'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${healthScore.score}%` }}
                transition={{ duration: 1.5, type: "spring" }}
              >
                <motion.div 
                  className="absolute inset-0 bg-white/20"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-time DB Sync Active</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        {/* Water tracker */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="card p-6 card-hover relative overflow-hidden group min-h-[340px] flex flex-col border-none shadow-xl shadow-blue-500/5"
        >
          {/* Animated Water Background */}
          <motion.div 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/20 to-blue-400/5 pointer-events-none"
            initial={{ height: "0%" }}
            animate={{ height: `${Math.min(((totalWater + waterInput) / 2.5) * 100, 100)}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          >
            {/* Wave Effect */}
            <motion.div 
              className="absolute top-0 left-0 right-0 h-8 bg-blue-300/10 backdrop-blur-[2px]"
              animate={{ 
                y: [0, -8, 0],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Floating Bubbles Particles */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-white/30 blur-[1px]"
                style={{ left: `${Math.random() * 100}%`, bottom: "-10px" }}
                animate={{ 
                  y: [-10, -300],
                  x: [0, Math.sin(i) * 20, 0],
                  opacity: [0, 0.6, 0]
                }}
                transition={{ 
                  duration: 4 + Math.random() * 4,
                  repeat: Infinity,
                  delay: Math.random() * 5
                }}
              />
            ))}
          </motion.div>

          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Hydration</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-tighter">
                {waterFeedback}
              </span>
            </div>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Droplets className="w-5 h-5 text-blue-600" />
            </motion.div>
          </div>

          <div className="flex-1 flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-center gap-4 mb-8">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setWaterInput(w => Math.max(0, w - 0.25))}
                className="w-12 h-12 rounded-2xl border border-gray-100 flex items-center justify-center hover:bg-white hover:shadow-xl transition-all bg-white/40 backdrop-blur-sm"
              >
                <Minus className="w-5 h-5 text-gray-400" />
              </motion.button>
              
              <div className="text-center relative">
                <motion.span 
                  key={waterInput}
                  initial={{ scale: 0.5, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="text-6xl font-black text-gray-900 tabular-nums block drop-shadow-sm"
                >
                  {waterInput.toFixed(2)}
                </motion.span>
                <span className="text-[10px] font-black text-gray-400 block uppercase mt-1 tracking-[0.2em]">Liters</span>
              </div>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setWaterInput(w => Math.min(4, w + 0.25))}
                className="w-12 h-12 rounded-2xl border border-gray-100 flex items-center justify-center hover:bg-white hover:shadow-xl transition-all bg-white/40 backdrop-blur-sm"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </motion.button>
            </div>

            {/* Quick Add Presets */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Glass", val: 0.25, icon: <GlassWater className="w-4 h-4" /> },
                { label: "Bottle", val: 0.5, icon: <Droplets className="w-4 h-4" /> },
                { label: "Large", val: 0.75, icon: <Droplets className="w-4 h-4 fill-current" /> }
              ].map((preset) => (
                <motion.button
                  key={preset.label}
                  whileHover={{ y: -3, backgroundColor: "rgba(255,255,255,0.8)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setWaterInput(w => Math.min(4, w + preset.val))}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/40 border border-white shadow-sm transition-all group/preset"
                >
                  <span className="text-blue-500 group-hover/preset:scale-125 transition-transform duration-300">{preset.icon}</span>
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">{preset.val}L</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="relative z-10 pt-2 border-t border-blue-100/30">
            <div className="h-2 bg-gray-100/50 rounded-full overflow-hidden mb-2 backdrop-blur-md">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min((totalWater / 2.5) * 100, 100)}%` }}
                transition={{ duration: 1.5 }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <span>Saved: {totalWater.toFixed(1)}L</span>
              <span>Goal: 2.5L</span>
            </div>
          </div>
        </motion.div>

        {/* Sleep */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="card p-6 card-hover relative overflow-hidden group min-h-[340px] flex flex-col border-none shadow-xl shadow-purple-500/5"
        >
          {/* Night Sky Background */}
          <motion.div 
            className="absolute inset-0 pointer-events-none transition-colors duration-1000"
            animate={{ 
              backgroundColor: sleepHrs >= 8 ? "#1e1b4b" : sleepHrs >= 6 ? "#312e81" : "#4338ca",
              opacity: 0.08 + (sleepHrs / 12) * 0.12
            }}
          />
          
          {/* Animated Stars */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]"
                style={{ 
                  top: `${Math.random() * 100}%`, 
                  left: `${Math.random() * 100}%`,
                  opacity: sleepHrs > 0 ? 0.6 : 0
                }}
                animate={{ 
                  scale: [1, 1.8, 1],
                  opacity: [0.3, 0.8, 0.3]
                }}
                transition={{ 
                  duration: 3 + Math.random() * 3, 
                  repeat: Infinity,
                  delay: Math.random() * 5
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Sleep Cycle</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 uppercase tracking-tighter">
                {sleepFeedback}
              </span>
            </div>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 6, repeat: Infinity }}
            >
              <Moon className="w-6 h-6 text-purple-600 filter drop-shadow-md" />
            </motion.div>
          </div>

          <div className="flex-1 flex flex-col justify-center relative z-10">
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] block px-1">Rest Time</label>
                <div className="relative group/time">
                  <input 
                    type="time" 
                    value={bedtime} 
                    onChange={(e) => setBedtime(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border border-purple-100/50 bg-white/70 text-base font-black text-gray-800 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 outline-none transition-all backdrop-blur-md shadow-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] block px-1">Wake Time</label>
                <div className="relative group/time">
                  <input 
                    type="time" 
                    value={wakeTime} 
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border border-amber-100/50 bg-white/70 text-base font-black text-gray-800 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none transition-all backdrop-blur-md shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <motion.div 
                key={sleepHrs}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="inline-flex items-baseline gap-2"
              >
                <span className="text-6xl font-black text-gray-900 tabular-nums tracking-tighter drop-shadow-sm">{sleepHrs.toFixed(1)}</span>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Hours</span>
              </motion.div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-purple-100/30">
            <Slider label="Adjust Total" value={sleepHrs} max={12} unit="h" color="#8b5cf6" onChange={setSleepHrs} />
          </div>
        </motion.div>

        {/* Mood */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="card p-6 card-hover relative overflow-hidden group min-h-[340px] flex flex-col border-none shadow-xl shadow-amber-500/5"
        >
          {/* Dynamic Mood Glow */}
          <motion.div 
            className="absolute inset-0 pointer-events-none"
            animate={{ 
              backgroundColor: 
                mood >= 3 ? "#fffbeb" : // Great/Good -> Warm Yellow
                mood === 2 ? "#f8fafc" : // Okay -> Cool White
                "#fdf2f2", // Poor -> Light Red
              opacity: mood >= 3 ? 0.6 : 0.3
            }}
            transition={{ duration: 1.5 }}
          />

          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Mindfulness</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 uppercase tracking-tighter">
                {moodFeedback}
              </span>
            </div>
            <Smile className="w-5 h-5 text-amber-600" />
          </div>

          <div className="flex-1 flex flex-col justify-center items-center relative z-10">
            <AnimatePresence mode="wait">
              <motion.div 
                key={mood}
                initial={{ scale: 0.2, rotate: -45, opacity: 0, filter: "blur(10px)" }}
                animate={{ scale: 1, rotate: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ scale: 0.2, rotate: 45, opacity: 0, filter: "blur(10px)" }}
                transition={{ type: "spring", damping: 12 }}
                className="text-8xl mb-4 filter drop-shadow-2xl select-none"
              >
                {moods[mood]}
              </motion.div>
            </AnimatePresence>
            <motion.p 
              key={moodLabels[mood]}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl font-black text-gray-900 tracking-tighter"
            >
              {moodLabels[mood]}
            </motion.p>
          </div>

          <div className="flex justify-between items-center gap-3 relative z-10 mt-8 bg-white/50 p-2 rounded-[1.5rem] backdrop-blur-md border border-white shadow-inner">
            {moods.map((m, i) => (
              <motion.button 
                key={i} 
                whileHover={{ scale: 1.2, y: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMood(i)} 
                className={`text-3xl flex-1 h-14 rounded-2xl transition-all flex items-center justify-center ${
                  mood === i 
                    ? "bg-white shadow-xl ring-2 ring-amber-100 z-10" 
                    : "hover:bg-white/40 opacity-30 hover:opacity-100"
                }`}
              >
                {m}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Symptoms */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="card p-6 shadow-xl shadow-red-500/5 border-none bg-gradient-to-br from-white to-red-50/20"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Symptom Tracker</h2>
              <p className="text-sm font-bold text-gray-800">How's your body feeling?</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{symptoms.length} Selected</span>
              <div className="flex gap-1 mt-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < symptoms.length ? 'bg-red-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {allSymptoms.map(s => {
              const active = symptoms.includes(s);
              const isAlert = ["Shortness of Breath", "Nausea", "Headache", "Swelling"].includes(s);
              return (
                <motion.button 
                  key={s} 
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSymptoms(prev => active ? prev.filter(x => x !== s) : [...prev, s])}
                  className={`px-5 py-3 rounded-2xl text-xs font-black transition-all border-2 relative overflow-hidden group/sym ${
                    active 
                      ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20" 
                      : "bg-white border-gray-100 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {active && (
                    <motion.div 
                      layoutId="sym-active"
                      className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 pointer-events-none" 
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {s}
                    {isAlert && !active && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* History Preview */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="card p-6 shadow-xl shadow-gray-500/5 border-none"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gray-100 text-gray-500">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Log History</h2>
            </div>
            <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline transition-all">View All</button>
          </div>
          
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching Cloud Data</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm font-bold text-gray-400">Your health story starts here.</p>
              </div>
            ) : (
              history.slice(0, 3).map((row, idx) => (
                <motion.div 
                  key={row.dateStr} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-[1.5rem] bg-gray-50/50 border border-gray-100 group/history hover:bg-white hover:shadow-md transition-all cursor-default"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-900">{row.date}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Status: Synchronized</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50">
                        <Droplets className="w-3 h-3 text-blue-500" />
                      </div>
                      <span className="text-xs font-black text-gray-700 tabular-nums">{row.water}L</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-50">
                        <Moon className="w-3 h-3 text-purple-500" />
                      </div>
                      <span className="text-xs font-black text-gray-700 tabular-nums">{row.sleep}h</span>
                    </div>
                    <motion.span 
                      whileHover={{ scale: 1.5, rotate: 10 }}
                      className="text-2xl filter drop-shadow-sm cursor-help"
                    >
                      {moods[moodLabels.indexOf(row.mood)]}
                    </motion.span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
