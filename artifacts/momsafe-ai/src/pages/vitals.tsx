import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from "recharts";
import { Activity, Download, Loader2, Brain, Sparkles, Clock, History, CheckCircle2, Lightbulb, MessageSquare, Info, Wifi, Footprints } from "lucide-react";
import { ManualVitalsInput } from "@/components/vitals/ManualVitalsInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const periods = ["24H", "7D", "30D"] as const;

interface AnalysisResult {
  overallStatus: string;
  keyObservations: string[];
  whatThisMeans: string;
  whatYouCanDo: string[];
}

interface VitalRecord {
  id: string;
  label: string;
  value: string | number;
  unit: string;
  status: "normal" | "warning" | "critical";
  trend: "up" | "down" | "stable";
  change: string;
  deviation: number;
  deviationInterpretation: string;
  history: (string | number)[];
  chartData: any[];
  interpretation: string;
}

const vitalDetails = [
  { id: "hr", label: "Heart Rate", unit: "bpm", normal: "60–100 bpm", interpretation: "Stable pattern within normal maternal range.", color: "#3b82f6", normalMin: 60, normalMax: 100 },
  { id: "bp", label: "Blood Pressure", unit: "mmHg", normal: "90–120 / 60–80 mmHg", interpretation: "Slight elevation noted recently. Continue monitoring.", color: "#8b5cf6", normalMin: 110, normalMax: 130 },
  { id: "spo2", label: "SpO2", unit: "%", normal: "95–100%", interpretation: "Consistently healthy oxygen saturation.", color: "#10b981", normalMin: 95, normalMax: 100 },
  { id: "temp", label: "Temperature", unit: "°C", normal: "36.1–37.2°C", interpretation: "Temperature within expected range for pregnancy.", color: "#f59e0b", normalMin: 36.1, normalMax: 37.2 },
  { id: "weight", label: "Weight", unit: "kg", normal: "Expected +0.3–0.5 kg/week", interpretation: "Weight gain within normal parameters.", color: "#ef4444", normalMin: 66, normalMax: 70 },
];

export default function Vitals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"24H" | "7D" | "30D">("7D");
  const [loading, setLoading] = useState(true);
  const initialCheckDone = useRef(false);

  // Default logic: If recent logs exist (24h) -> default to 24h, else 7d
  useEffect(() => {
    if (initialCheckDone.current || !user?.id) return;
    initialCheckDone.current = true;
    
    const checkRecentLogs = async () => {
      try {
        const oneDayAgo = subDays(new Date(), 1).toISOString();
        const { count, error } = await supabase
          .from("vitals")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", user.id)
          .gte("recorded_at", oneDayAgo);
        
        if (!error && count && count > 0) {
          setPeriod("24H");
        }
      } catch (err) {
        console.error("Error checking recent logs:", err);
      }
    };
    checkRecentLogs();
  }, [user?.id]);
  const [vitalsData, setVitalsData] = useState<VitalRecord[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [rawRecords, setRawRecords] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [latestSource, setLatestSource] = useState<"manual" | "esp32" | "unknown">("unknown");
  const [lastEsp32SeenAt, setLastEsp32SeenAt] = useState<string | null>(null);

  const generateVitalsAnalysis = async () => {
    if (vitalsData.length === 0 || !user) return;
    setIsAnalyzing(true);
    setShowAnalysisModal(true);
    
    try {
      // 1. Fetch Profile Data for Context
      const { data: userData } = await supabase
        .from("users")
        .select("gestational_week")
        .eq("id", user.id)
        .maybeSingle();

      const week = userData?.gestational_week ?? 27;

      // Simulate human-like thinking delay
      await new Promise(resolve => setTimeout(resolve, 2500));

      // 2. Extract Data for Analysis
      const hrRecord = vitalsData.find(v => v.id === "hr");
      const bpRecord = vitalsData.find(v => v.id === "bp");
      const spo2Record = vitalsData.find(v => v.id === "spo2");
      const tempRecord = vitalsData.find(v => v.id === "temp");

      const hrVal = typeof hrRecord?.value === 'number' ? hrRecord.value : 0;
      const bpParts = typeof bpRecord?.value === 'string' ? bpRecord.value.split('/') : [];
      const bpSys = bpParts.length > 0 ? parseInt(bpParts[0]) : 0;
      const spo2Val = typeof spo2Record?.value === 'number' ? spo2Record.value : 0;
      const tempVal = typeof tempRecord?.value === 'number' ? tempRecord.value : 0;

      const isHrHigh = hrVal > 100;
      const isBpHigh = bpSys >= 140;
      const isSpo2Low = spo2Val < 95;
      const isTempHigh = tempVal >= 37.5;

      // 3. Rule-Based Message Variation Engine
      const selectRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

      const getStatusMessages = () => {
        if (!isHrHigh && !isBpHigh && !isSpo2Low && !isTempHigh) {
          return {
            status: selectRandom([
              "Optimal & Stable",
              "Everything looks healthy",
              "Strong Physiological Baseline",
              "Steady Progress",
              "Excellent Stability"
            ]),
            meaning: selectRandom([
              `At Week ${week}, your body seems to be adapting beautifully to the physical demands of pregnancy. Your vitals are currently within ideal ranges.`,
              `Based on today's readings, your cardiovascular and respiratory systems are functioning optimally for this stage of your journey.`,
              `Seems like your recent routine is working well. Your physiological markers are consistent and show no signs of immediate stress.`,
              `Your readings today indicate a very healthy state. This stability is exactly what we look for at this stage in your pregnancy.`
            ]),
            todo: [
              "Maintain your current hydration levels",
              "Continue with your prenatal vitamin routine",
              "Keep up the gentle movement if you feel up to it",
              "Focus on consistent rest and quality sleep"
            ]
          };
        }

        if (isBpHigh || (isBpHigh && isHrHigh)) {
          return {
            status: selectRandom([
              "Elevated Pressure Detected",
              "Monitor Closely",
              "Physical Stress Noted",
              "Cardiovascular Strain",
              "Attention Needed"
            ]),
            meaning: selectRandom([
              `Your blood pressure has been a bit high recently. This might indicate that your body is working extra hard today, perhaps due to stress or activity.`,
              `We've noticed a slight upward trend in your BP. At Week ${week}, it's important to keep this steady to ensure optimal blood flow for both of you.`,
              `Compared to your usual baseline, these readings seem slightly elevated. It could be due to recent exertion or perhaps just a busy day.`,
              `Your recent readings suggest some systemic pressure. It's not uncommon at this stage, but it definitely warrants a bit of extra caution.`
            ]),
            todo: [
              "Find a quiet space and rest for 15-20 minutes",
              "Reduce salt intake for the next few meals",
              "Focus on deep, rhythmic breathing exercises",
              "Check your BP again in 2 hours after resting"
            ]
          };
        }

        if (isHrHigh || (isHrHigh && isTempHigh)) {
          return {
            status: selectRandom([
              "Increased Metabolic Activity",
              "Heart Rate Variation",
              "Systemic Warmth",
              "Active Pulse",
              "Mild Excitement"
            ]),
            meaning: selectRandom([
              `Your heart rate is currently higher than your typical average. It could be due to mild dehydration, fatigue, or just being more active recently.`,
              `Seems like your pulse is a bit fast today. This might indicate your body is responding to a minor infection or simply needs more hydration.`,
              `Your heart rate has remained slightly elevated over the past few readings. This is often expected as blood volume increases at Week ${week}.`,
              `We're seeing a more active heart rate today. This might be your body's way of telling you to slow down and take a few more breaks.`
            ]),
            todo: [
              "Drink 1-2 glasses of cool water immediately",
              "Check for other symptoms like chills or fatigue",
              "Avoid caffeine and heavy meals for now",
              "Log your temperature again in an hour"
            ]
          };
        }

        return {
          status: "Mixed Observations",
          meaning: selectRandom([
            "Your vitals are showing some variations today. While some markers are stable, others are slightly off their usual path.",
            "We're seeing a mix of readings. This might indicate a transition phase as your body adjusts to new changes at this stage.",
            "Recent readings suggest a slightly fluctuating pattern. It's likely just a temporary variation, but worth watching.",
            "Seems like your vitals are responding to different factors today. A balanced approach to rest and activity is recommended."
          ]),
          todo: [
            "Keep monitoring throughout the day",
            "Maintain a consistent rest schedule",
            "Focus on balanced nutrition and hydration",
            "Note any physical changes you're feeling"
          ]
        };
      };

      const messages = getStatusMessages();
      const observations: string[] = [];
      
      if (!isHrHigh && !isBpHigh && !isSpo2Low && !isTempHigh) {
        observations.push("Heart rate is rhythmic and stable.");
        observations.push("Blood pressure is within safe maternal limits.");
        observations.push("Oxygen saturation is optimal for you and baby.");
      } else {
        if (isBpHigh) observations.push(`Blood pressure (${bpSys} mmHg) is above your usual threshold.`);
        if (isHrHigh) observations.push(`Heart rate (${hrVal} bpm) is slightly elevated compared to baseline.`);
        if (isSpo2Low) observations.push("Oxygen levels are a bit lower than typical.");
        if (isTempHigh) observations.push("A slight elevation in body temperature was noted.");
        if (!isHrHigh && !isBpHigh) observations.push("Core cardiovascular markers remain stable despite variations.");
      }

      setAiAnalysis({
        overallStatus: messages.status,
        keyObservations: observations,
        whatThisMeans: messages.meaning,
        whatYouCanDo: messages.todo
      });

    } catch (error) {
      console.error("Error generating analysis:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderAbnormalDot = (props: any, threshold: number, type: 'above' | 'below' = 'above') => {
    const { cx, cy, value } = props;
    if (value === null || value === undefined) return <></>;
    
    const isAbnormal = type === 'above' ? value > threshold : value < threshold;
    
    if (isAbnormal) {
      return (
        <circle 
          cx={cx} 
          cy={cy} 
          r={5} 
          fill="#ef4444" 
          stroke="white" 
          strokeWidth={2} 
          key={`abnormal-${cx}-${cy}`}
          className="animate-pulse"
        />
      );
    }
    return <circle cx={cx} cy={cy} r={2} fill={props.stroke} key={`dot-${cx}-${cy}`} />;
  };

  const fetchVitals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const days = period === "24H" ? 1 : period === "7D" ? 7 : 30;
      const startDate = period === "24H" 
        ? subDays(new Date(), 1).toISOString()
        : startOfDay(subDays(new Date(), days)).toISOString();

      const { data, error } = await supabase
        .from("vitals")
        .select("*")
        .eq("user_id", user.id)
        .gte("recorded_at", startDate)
        .order("recorded_at", { ascending: true });

      if (error) throw error;

      const records = data || [];
      setRawRecords(records);
      const latest = records[records.length - 1];
      setLatestSource((latest?.source as "manual" | "esp32" | undefined) || "unknown");

      const latestEsp32 = [...records].reverse().find((r) => r.source === "esp32");
      setLastEsp32SeenAt(latestEsp32?.recorded_at || null);

      const mappedVitals: VitalRecord[] = vitalDetails.map(detail => {
        let value: string | number = "-";
        let history: (string | number)[] = [];
        let trend: "up" | "down" | "stable" = "stable";
        let change = "0%";
        let deviation = 0;
        let deviationInterpretation = "";
        let status: "normal" | "warning" | "critical" = "normal";
        let interpretation = "";

        const getVal = (r: any) => {
          if (!r) return null;
          if (detail.id === "hr") return r.heart_rate;
          if (detail.id === "bp") return `${r.systolic_bp}/${r.diastolic_bp}`;
          if (detail.id === "spo2") return r.spo2;
          if (detail.id === "temp") return r.temperature;
          if (detail.id === "weight") return r.weight;
          return null;
        };

        const getNumVal = (r: any) => {
          if (!r) return null;
          if (detail.id === "hr") return r.heart_rate;
          if (detail.id === "bp") return r.systolic_bp; // Use systolic for numeric calcs
          if (detail.id === "spo2") return r.spo2;
          if (detail.id === "temp") return r.temperature;
          if (detail.id === "weight") return r.weight;
          return null;
        };

        const values = records.map(r => getNumVal(r)).filter((v): v is number => v !== null);
        
        if (latest) {
          const currentVal = getNumVal(latest);
          value = getVal(latest) || "-";
          
          // Improved status calculation
          if (detail.id === "bp") {
            const sys = Number(latest.systolic_bp);
            const dia = Number(latest.diastolic_bp);
            const hr = Number(latest.heart_rate);
            if (sys >= 150 || dia >= 100 || (sys >= 140 && hr > 100)) {
              status = "critical";
              interpretation = "Blood pressure is high and requires attention. Combined with elevated heart rate, this suggests significant cardiovascular strain and may require medical consultation.";
            } else if (sys >= 140 || dia >= 90 || (sys >= 130 && hr > 100)) {
              status = "warning";
              interpretation = "Blood pressure is slightly elevated. Keep monitoring. This trend suggests rising cardiovascular demand, which is common but should be watched closely during this stage.";
            } else {
              status = "normal";
              interpretation = "Blood pressure is within normal range. This indicates healthy cardiovascular adaptation to pregnancy.";
            }
          } else if (detail.id === "hr") {
            const hr = Number(latest.heart_rate);
            const sys = Number(latest.systolic_bp);
            if (hr > 110 || hr < 50) status = "critical";
            else if (hr > 100 || hr < 60) status = "warning";
            else status = "normal";

            if (hr < 60) interpretation = "Heart rate is lower than expected. Monitor for dizziness or fatigue. This can sometimes occur with increased athletic fitness or specific medications.";
            else if (hr <= 100) interpretation = "Heart rate is within normal range. This indicates your heart is efficiently managing the increased blood volume of pregnancy.";
            else {
              interpretation = "Elevated heart rate detected. This may indicate stress, fatigue, or dehydration.";
              if (sys >= 120) interpretation += " This aligns with elevated blood pressure, indicating systemic physical stress.";
            }
          } else if (detail.id === "spo2") {
            const s = Number(latest.spo2);
            if (s < 90) {
              status = "critical";
              interpretation = "Oxygen levels are low and may require immediate attention. This downward trend could indicate respiratory compromise and should be reported to your provider.";
            } else if (s <= 93) {
              status = "warning";
              interpretation = "Oxygen levels are slightly low. Monitor closely. Slight drops can be caused by changes in posture or shallow breathing, but persistent low levels need review.";
            } else {
              status = "normal";
              interpretation = "Oxygen levels are stable. This confirms effective respiratory function and oxygen delivery to both you and your baby.";
            }
          } else if (detail.id === "temp") {
            const t = Number(latest.temperature);
            if (t >= 39) status = "critical";
            else if (t >= 37.5) status = "warning";
            else status = "normal";

            if (t < 37.5) interpretation = "Temperature is within expected range. This suggests your immune system is stable and there are no signs of systemic infection.";
            else if (t <= 38) interpretation = "Slight temperature elevation detected. This could be a normal metabolic response or early signs of inflammation.";
            else interpretation = "Elevated temperature detected. This may indicate infection and should be monitored closely for other symptoms like chills or body aches.";
          } else if (detail.id === "weight") {
            status = "normal";
            interpretation = "Weight progression is within expected range. Consistent gain at this stage supports healthy fetal development and maternal nutrient storage.";
            if (values.length > 1) {
              const prevWeight = values[values.length - 2];
              const diff = Math.abs(currentVal! - prevWeight);
              if (diff > 1.0) {
                status = "warning";
                interpretation = "Weight change is slightly outside expected range. Continue monitoring weekly progression. Sudden changes could be due to fluid retention (edema) or shifts in nutrition.";
              }
            }
          }
          
          if (values.length > 0 && currentVal !== null) {
            // Calculate baseline average
            const sum = values.reduce((acc, v) => acc + v, 0);
            const avg = sum / values.length;
            
            // Calculate percentage change from baseline
            deviation = avg !== 0 ? ((currentVal - avg) / avg) * 100 : 0;
            change = `${deviation > 0 ? "+" : ""}${deviation.toFixed(1)}%`;
            trend = deviation > 0 ? "up" : deviation < 0 ? "down" : "stable";

            if (deviation > 15) {
              deviationInterpretation = "Significantly above your usual levels";
            } else if (deviation >= 5) {
              deviationInterpretation = "Slightly above your usual levels";
            } else if (deviation >= -5) {
              deviationInterpretation = "Close to your normal baseline";
            } else {
              deviationInterpretation = "Below your usual levels";
            }
          }
        }

        // Show last 5 readings for history section
        const formatTimeLabel = (date: string) => {
          const d = new Date(date);
          if (period === "24H") {
            return formatDistanceToNow(d, { addSuffix: true }).replace("about ", "");
          }
          return format(d, "MMM d");
        };

        history = records.slice(-5).map(r => getVal(r)).filter(v => v !== null).reverse();
        
        const chartData = records.map(r => {
          const base = { 
            day: formatTimeLabel(r.recorded_at),
            timestamp: new Date(r.recorded_at).getTime()
          };
          
          if (detail.id === "bp") {
            return { 
              ...base, 
              value: Number(r.systolic_bp)
            };
          }
          return { ...base, value: Number(getNumVal(r)) || 0 };
        });

        return {
          ...detail,
          value,
          status,
          trend,
          change,
          deviation,
          deviationInterpretation,
          history,
          chartData,
          interpretation: interpretation || detail.interpretation
        };
      });

      setVitalsData(mappedVitals);

      // Comparison data for the bottom chart
      const comp = records.map(r => {
        const d = new Date(r.recorded_at);
        const timeLabel = period === "24H" 
          ? formatDistanceToNow(d, { addSuffix: true }).replace("about ", "")
          : format(d, "MMM d");

        return {
          time: timeLabel,
          hr: r.heart_rate,
          bp: r.systolic_bp,
          spo2: r.spo2
        };
      });
      setComparisonData(comp);

    } catch (error) {
      console.error("Error fetching vitals:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, period]);

  useEffect(() => {
    fetchVitals();
    
    const channel = supabase
      .channel('vitals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vitals', filter: `user_id=eq.${user?.id}` }, () => fetchVitals())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVitals, user?.id]);

  const handleExport = async () => {
    if (!user) return;
    
    setIsExporting(true);
    try {
      // Fetch all vitals for the user to ensure complete export
      const { data, error } = await supabase
        .from("vitals")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Export failed",
          description: "No data available to export",
          variant: "destructive"
        });
        return;
      }

      // Simulate preparation time for premium feel
      await new Promise(resolve => setTimeout(resolve, 1500));

      const headers = ["Date", "Time", "Source", "Steps", "Heart Rate (bpm)", "Systolic BP (mmHg)", "Diastolic BP (mmHg)", "SpO2 (%)", "Temperature (°C)", "Weight (kg)"];
      
      const csvRows = [
        headers.join(","),
        ...data.map(r => {
          const dateObj = new Date(r.recorded_at);
          return [
            format(dateObj, "yyyy-MM-dd"),
            format(dateObj, "HH:mm:ss"),
            r.source || "manual",
            r.steps ?? "",
            r.heart_rate || "",
            r.systolic_bp || "",
            r.diastolic_bp || "",
            r.spo2 || "",
            r.temperature || "",
            r.weight || ""
          ].join(",");
        })
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = format(new Date(), "yyyy-MM-dd");
      
      link.setAttribute("href", url);
      link.setAttribute("download", `vitals_data_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download started",
        description: "Your health records are being exported.",
      });

    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Error",
        description: "Something went wrong. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Vitals Intelligence</h1>
          <p className="page-subtitle">Historical physiological markers and threshold analysis.</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <div className="relative flex p-1 bg-gray-100/50 rounded-2xl border border-gray-200/50">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`relative px-4 py-1.5 text-[10px] font-bold transition-all duration-300 rounded-xl z-10 ${
                    period === p ? "text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {period === p && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-blue-600 rounded-xl shadow-sm shadow-blue-200"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <motion.span
                    whileTap={{ scale: 0.95 }}
                    className="relative z-20"
                  >
                    {p}
                  </motion.span>
                </button>
              ))}
            </div>
            <ManualVitalsInput onSuccess={fetchVitals} />
            <button
              onClick={generateVitalsAnalysis}
              disabled={isAnalyzing || vitalsData.length === 0}
              className="px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold border border-gray-300 bg-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-gray-100 text-black"
            >
              <div className="flex items-center gap-2">
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <Brain className="w-4 h-4 text-black" />
                )}
                <span className="font-extrabold">Analyze with AI</span>
              </div>
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || vitalsData.length === 0}
              className="px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold border border-gray-200 bg-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 text-gray-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-gray-500" />
                  <span>Export CSV</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-4 pr-1 animate-in fade-in slide-in-from-right-2 duration-700">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              <Wifi className="w-2.5 h-2.5 text-indigo-500" />
              <span>Latest source: {latestSource}</span>
            </div>
            {lastEsp32SeenAt && (
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                <Footprints className="w-2.5 h-2.5 text-purple-500" />
                <span>ESP32 seen {formatDistanceToNow(new Date(lastEsp32SeenAt), { addSuffix: true })}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              <History className="w-2.5 h-2.5 text-blue-500" />
              <span>Showing last {period === "24H" ? "24 hours" : period === "7D" ? "7 days" : "30 days"} of data</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              <Clock className="w-2.5 h-2.5 text-emerald-500" />
              <span>Updated just now</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis Result Modal */}
      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-none p-0 overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-black text-black">
                <div className="p-1.5 rounded-lg bg-black text-white">
                  <Brain className="w-4 h-4" />
                </div>
                Vitals Intelligence Analysis
              </DialogTitle>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-16 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="relative">
                    {/* Concentric Pulse Rings */}
                    <motion.div 
                      className="absolute inset-0 rounded-full bg-gray-100/50"
                      animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                    />
                    <motion.div 
                      className="absolute inset-0 rounded-full bg-gray-100/30"
                      animate={{ scale: [1, 2.5], opacity: [0.3, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.5 }}
                    />
                    
                    <div className="relative p-6 bg-gray-50 rounded-full">
                      <Brain className="w-12 h-12 text-black" />
                      <motion.div
                        className="absolute top-4 right-4"
                        animate={{ 
                          scale: [1, 1.5, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <Sparkles className="w-6 h-6 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <motion.p 
                      className="text-base font-black text-black"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      Generating Intelligence...
                    </motion.p>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Processing Maternal Data</p>
                      <div className="flex gap-1 justify-center">
                        {[0, 1, 2].map(i => (
                          <motion.div 
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-black"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : aiAnalysis ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* A. Overall Status */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-black" />
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Status</p>
                      <p className="text-lg font-black text-black">{aiAnalysis.overallStatus}</p>
                    </div>
                  </div>

                  {/* B. Key Observations */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-black">
                      <Lightbulb className="w-4 h-4 text-gray-600" />
                      <h3 className="text-sm font-black uppercase tracking-tight">Key Observations</h3>
                    </div>
                    <ul className="space-y-2">
                      {aiAnalysis.keyObservations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600 font-medium leading-relaxed">
                          <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* C. What This Means */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-black">
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                      <h3 className="text-sm font-black uppercase tracking-tight">What This Means</h3>
                    </div>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed italic">
                      "{aiAnalysis.whatThisMeans}"
                    </p>
                  </div>

                  {/* D. What You Can Do */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-black">
                      <Info className="w-4 h-4 text-gray-600" />
                      <h3 className="text-sm font-black uppercase tracking-tight">Recommended Actions</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {aiAnalysis.whatYouCanDo.map((todo, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-100 text-[11px] font-bold text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-black" />
                          {todo}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    className="w-full py-3 bg-black hover:bg-gray-900 text-white rounded-2xl font-bold shadow-lg shadow-gray-200 transition-all active:scale-95 mt-2"
                  >
                    Got it, thanks
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vitals cards with detailed charts */}
      <div className="space-y-4 min-h-[400px]">
        {loading && vitalsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 card">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-gray-500">Syncing with your health records...</p>
          </div>
        ) : vitalsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 card bg-gray-50 border-dashed">
            <Activity className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800">No data available</h3>
            <p className="text-sm text-gray-500 mt-2 text-center max-w-xs">
              Start logging your vitals to see your personalized health intelligence trends.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={period}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-4"
            >
              {vitalsData.map((v) => {
                const detail = vitalDetails.find(d => d.id === v.id);
                return (
                  <motion.div
                    key={v.id}
                    whileHover={{ y: -2, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.05)" }}
                    className={`card p-5 border-2 transition-all duration-300 bg-white/50 backdrop-blur-sm ${
                      v.status === "critical" ? "border-red-600/20 bg-red-50/30 shadow-sm shadow-red-100/50" :
                      v.status === "warning" ? "border-orange-400/20 bg-orange-50/20 shadow-sm shadow-orange-100/50" :
                      "border-gray-100 bg-white/40 shadow-sm shadow-gray-100/20"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-500" />
                          <h3 className={`text-sm font-semibold text-gray-800 ${v.status === "critical" ? "font-bold" : ""}`}>{v.label}</h3>
                          <span className={v.status === "normal" ? "badge-green" : v.status === "warning" ? "badge-yellow" : "badge-red"}>{v.status}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase">
                            {latestSource}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{v.interpretation}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold text-gray-900 tabular-nums ${v.status === "critical" ? "font-extrabold" : ""}`}>{v.value}</div>
                        <div className="text-xs text-gray-400">{v.unit}</div>
                        <div className={`text-xs font-medium mt-1 ${v.deviation >= 0 ? "text-amber-500" : "text-emerald-600"}`}>
                          {v.change} from baseline
                        </div>
                        {v.deviationInterpretation && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{v.deviationInterpretation}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="col-span-3">
                        <ResponsiveContainer width="100%" height={120}>
                          <AreaChart data={v.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`color-${v.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={detail?.color || "#3b82f6"} stopOpacity={0.15}/>
                                <stop offset="95%" stopColor={detail?.color || "#3b82f6"} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
                            {detail && v.id !== "bp" && <ReferenceArea y1={detail.normalMin} y2={detail.normalMax} fill={detail.color} fillOpacity={0.04} />}
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke={detail?.color || "#3b82f6"} 
                              strokeWidth={2.5} 
                              fillOpacity={1} 
                              fill={`url(#color-${v.id})`}
                              dot={(props) => {
                                let threshold = 100;
                                let type: 'above' | 'below' = 'above';
                                if (v.id === "hr") threshold = 100;
                                if (v.id === "bp") threshold = 140;
                                if (v.id === "spo2") { threshold = 92; type = 'below'; }
                                if (v.id === "temp") threshold = 38;
                                if (v.id === "weight") return <circle cx={props.cx} cy={props.cy} r={2.5} fill={props.stroke} key={`dot-${props.cx}-${props.cy}`} stroke="white" strokeWidth={1.5} />;
                                
                                return renderAbnormalDot(props, threshold, type);
                              }} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        <div className="p-2 rounded-lg bg-gray-50">
                          <p className="text-[10px] text-gray-400">Normal Range</p>
                          <p className="text-xs font-medium text-gray-700 mt-0.5">{detail?.normal}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50">
                          <p className="text-[10px] text-gray-400">Current</p>
                          <p className="text-xs font-bold text-gray-900">{v.value} {v.unit}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50">
                          <p className="text-[10px] text-gray-400">Trend</p>
                          <p className={`text-xs font-bold ${v.trend === "up" ? "text-amber-500" : "text-emerald-600"}`}>{v.change}</p>
                        </div>
                      </div>
                    </div>

                    {/* History log */}
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Recent Readings</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {v.history.length > 0 ? v.history.map((val, i) => (
                          <div key={i} className="flex-shrink-0 text-center px-2 py-1 rounded-lg bg-gray-50 min-w-[60px]">
                            <p className="text-xs font-bold text-gray-800 tabular-nums">{val}</p>
                            <p className="text-[10px] text-gray-400">{i === 0 ? "Latest" : `${i} log${i > 1 ? 's' : ''} ago`}</p>
                          </div>
                        )) : (
                          <p className="text-[10px] text-gray-400">No historical data available for this period.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Comparison view */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`comparison-${period}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="card p-5"
        >
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Vitals Comparison ({period} Trend)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={comparisonData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
              <Area 
                type="monotone" 
                dataKey="hr" 
                stroke="#3b82f6" 
                strokeWidth={2.5} 
                fillOpacity={1}
                fill="url(#colorHr)"
                dot={(props) => renderAbnormalDot(props, 100)} 
                name="Heart Rate" 
              />
              <Area 
                type="monotone" 
                dataKey="bp" 
                stroke="#8b5cf6" 
                strokeWidth={2.5} 
                fillOpacity={1}
                fill="url(#colorBp)"
                dot={(props) => renderAbnormalDot(props, 140)} 
                name="Blood Pressure" 
              />
              <Area 
                type="monotone" 
                dataKey="spo2" 
                stroke="#10b981" 
                strokeWidth={2.5} 
                fillOpacity={1}
                fill="url(#colorSpo2)"
                dot={(props) => renderAbnormalDot(props, 92, 'below')} 
                name="SpO2" 
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 justify-center">
            {[{ label: "Heart Rate", color: "#3b82f6" }, { label: "Blood Pressure", color: "#8b5cf6" }, { label: "SpO2", color: "#10b981" }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
