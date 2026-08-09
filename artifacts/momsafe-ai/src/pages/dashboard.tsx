import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, Activity, BellRing, Droplets, Moon, ChevronRight, CheckCircle2, ShieldCheck, Info, X, Heart, Wind, Zap, Footprints } from "lucide-react";
import { trendData } from "@/lib/mock-data";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, addWeeks } from "date-fns";
import { ManualVitalsInput } from "@/components/vitals/ManualVitalsInput";
import { calculateRiskScore, RiskHealthData } from "@/lib/ai/riskEngine";
import { generateGuidance, GuidanceItem, UserHealthData } from "@/lib/ai/guidanceEngine";
import { motion, AnimatePresence, useSpring, useTransform, animate } from "framer-motion";

import { isToday, isYesterday } from "date-fns";

function AnimatedScore({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.floor(latest))
    });
    return () => controls.stop();
  }, [value]);

  return <span className="tabular-nums">{displayValue}</span>;
}

const statusColor: Record<string, string> = {
  normal: "badge-green",
  warning: "badge-yellow",
  critical: "badge-red",
};

const alertColor: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50",
  warning: "border-l-amber-400 bg-amber-50",
  info: "border-l-blue-400 bg-blue-50",
};
const alertBadge: Record<string, string> = {
  critical: "badge-red",
  warning: "badge-yellow",
  info: "badge-blue",
};

interface Vital {
  id: number;
  label: string;
  value: string | number;
  unit: string;
  status: "normal" | "warning" | "critical";
  trend: "up" | "down" | "stable";
  change: string | number;
  history: number[];
  historyTimestamps?: string[];
  description?: string;
  insight?: string;
  tags?: string[];
  deviationInterpretation?: string;
  lastUpdated?: string;
  stability?: "Stable" | "Fluctuating" | "Needs monitoring";
  safeRange?: { min: number; max: number };
}

function VitalCard({ vital, onClick, isProblematic }: { vital: Vital; onClick: () => void; isProblematic: boolean }) {
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState(0);

  const defaultNumericValue = typeof vital.value === 'number' ? vital.value : parseFloat(String(vital.value).split('/')[0]) || 0;
  
  const recentHistory = vital.history.slice(-5);
  const recentTimestamps = (vital.historyTimestamps || []).slice(-5);
  const activeNumericValue = selectedHistoryIndex !== null ? recentHistory[selectedHistoryIndex] : defaultNumericValue;

  const getStatusForValue = (val: number, label: string) => {
    if (label === "Heart Rate") {
      if (val > 110 || val < 50) return "critical";
      if (val > 100 || val < 60) return "warning";
      return "normal";
    }
    if (label === "Blood Pressure") {
      if (val >= 150) return "critical";
      if (val >= 140) return "warning";
      return "normal";
    }
    if (label === "SpO2") {
      if (val < 90) return "critical";
      if (val <= 93) return "warning";
      return "normal";
    }
    if (label === "Temperature") {
      if (val >= 39) return "critical";
      if (val >= 37.5) return "warning";
      return "normal";
    }
    return "normal";
  };

  const activeStatus = selectedHistoryIndex !== null ? getStatusForValue(activeNumericValue, vital.label) : vital.status;

  useEffect(() => {
    const controls = animate(displayValue, activeNumericValue, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(latest)
    });
    return () => controls.stop();
  }, [activeNumericValue]);

  const statusColors = {
    normal: "emerald",
    warning: "amber",
    critical: "red"
  };
  const color = statusColors[activeStatus];

  const safeMin = vital.safeRange?.min || 0;
  const safeMax = vital.safeRange?.max || 100;
  const chartMax = Math.max(safeMax * 1.2, activeNumericValue * 1.1, 100);

  const formattedDisplayValue = typeof vital.value === 'string' && vital.value.includes('/') 
    ? `${Math.round(displayValue)}/${Math.round(displayValue * 0.66)}` 
    : Math.floor(displayValue);

  return (
    <motion.div
      layoutId={`vital-${vital.id}`}
      whileHover={{ scale: 1.02, translateY: -4 }}
      className={`card p-5 transition-all duration-300 relative overflow-visible group border-2
        ${activeStatus === "critical" ? "border-red-500 shadow-lg shadow-red-100 bg-red-50/30" : 
          activeStatus === "warning" ? "border-amber-400 shadow-md shadow-amber-100 bg-amber-50/20" : 
          "border-emerald-500/10 bg-white hover:border-emerald-500/20 shadow-sm"}
        ${isProblematic && activeStatus !== "normal" ? "ring-4 ring-offset-2 ring-red-500/20 animate-pulse-subtle" : ""}
      `}
    >
      <motion.div 
        whileTap={{ scale: 0.98 }}
        className="cursor-pointer relative z-10" 
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{vital.label}</span>
          <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm transition-colors duration-300
            ${activeStatus === 'normal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
              activeStatus === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
              'bg-red-50 text-red-600 border-red-100'}
          `}>
            {activeStatus}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-gray-900 tabular-nums">
              {formattedDisplayValue}
            </span>
            <span className="text-xs font-bold text-gray-400 uppercase">{vital.unit}</span>
          </div>
          <div className={`flex items-center gap-1.5 mt-1 text-[10px] font-black transition-colors duration-300 ${vital.trend === 'up' ? (vital.label === 'Blood Pressure' || vital.label === 'Heart Rate' ? 'text-red-500' : 'text-emerald-600') : vital.trend === 'down' ? (vital.label === 'SpO2' ? 'text-red-500' : 'text-emerald-600') : 'text-gray-400'}`}>
            {vital.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : vital.trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {vital.change !== '0' ? `${vital.change} since last` : 'No change'}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${activeStatus === 'normal' ? 'bg-emerald-500' : activeStatus === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
            <span className="text-[10px] font-bold text-gray-500 uppercase">{vital.stability || "Stable"}</span>
          </div>
          <span className="text-[9px] font-medium text-gray-400">{vital.lastUpdated || "Just now"}</span>
        </div>
      </motion.div>

      <div className="space-y-4 relative z-20 pt-4 border-t border-gray-100/50 mt-3">
        {vital.safeRange && (
          <div className="group/bar relative mb-2">
            <div className="h-1.5 w-full bg-gray-100 rounded-full relative cursor-help">
              <div className="absolute inset-0 bg-gray-200/50 rounded-full" />
              
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-30 shadow-xl flex flex-col items-center gap-0.5">
                <span className="text-gray-300">Normal range: {vital.safeRange.min}-{vital.safeRange.max} {vital.unit}</span>
                <span className={activeNumericValue > vital.safeRange.max ? "text-amber-400" : activeNumericValue < vital.safeRange.min ? "text-amber-400" : "text-emerald-400"}>
                  You are {activeNumericValue > vital.safeRange.max ? "above normal" : activeNumericValue < vital.safeRange.min ? "below normal" : "in normal range"}
                </span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>

              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                className={`h-full bg-${color}-500/20 absolute rounded-full transition-colors duration-300`}
                style={{ 
                  left: `${(vital.safeRange.min / chartMax) * 100}%`, 
                  width: `${((vital.safeRange.max - vital.safeRange.min) / chartMax) * 100}%` 
                }}
              />
              
              <motion.div 
                initial={{ left: 0 }}
                animate={{ left: `${(activeNumericValue / chartMax) * 100}%` }}
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-${color}-500 rounded-full ring-2 ring-white z-10 shadow-sm cursor-pointer group/pointer transition-colors duration-300`}
              >
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/pointer:opacity-100 transition-opacity pointer-events-none z-40 shadow-xl whitespace-nowrap">
                   Current: {Math.round(activeNumericValue)} {vital.unit}
                   <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                 </div>
              </motion.div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center pt-2">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Recent readings</span>
          <div className="flex gap-2.5 justify-center items-center">
            {recentHistory.map((h, i) => {
              const ts = recentTimestamps[i];
              const timeAgo = ts
                ? formatDistanceToNow(new Date(ts), { addSuffix: true })
                : (i === recentHistory.length - 1 ? "Just now" : `${(recentHistory.length - 1 - i) * 2}h ago`);
              const isSelected = selectedHistoryIndex === i || (selectedHistoryIndex === null && i === recentHistory.length - 1);
              
              return (
                <div key={i} className="group/dot relative">
                  <motion.button 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 20 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHistoryIndex(i);
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ring-2 ring-offset-1 
                      ${isSelected ? `bg-${color}-500 ring-${color}-200 scale-125` : 'bg-gray-200 ring-transparent hover:bg-gray-300'}
                    `} 
                  />
                  
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl flex items-center justify-center whitespace-nowrap">
                    {h} {vital.unit} - {timeAgo}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VitalFocusModal({ vital, pregnancyWeek, onClose }: { vital: Vital; pregnancyWeek: number | null; onClose: () => void }) {
  const numericValue = typeof vital.value === 'number' ? vital.value : parseFloat(String(vital.value).split('/')[0]) || 0;
  
  const getExplanation = () => {
    if (vital.label === "Heart Rate") return "Your heart rate reflects how hard your body is working to support you and your baby.";
    if (vital.label === "Blood Pressure") return "BP monitoring is crucial to detect signs of preeclampsia early.";
    if (vital.label === "SpO2") return "Oxygen saturation measures how well your lungs are delivering oxygen to your bloodstream.";
    return "This reading helps monitor your overall physiological stability.";
  };

  const getAction = () => {
    if (vital.status === "critical") return "Contact your healthcare provider immediately or use the Emergency Help button.";
    if (vital.status === "warning") return "Rest, hydrate, and re-check in 30 minutes. Log any symptoms.";
    return "Continue your current routine and regular monitoring.";
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        layoutId={`vital-${vital.id}`}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100"
      >
        <div className={`p-8 text-white ${vital.status === 'normal' ? 'bg-emerald-600' : vital.status === 'warning' ? 'bg-amber-500' : 'bg-red-600'}`}>
          <div className="flex justify-between items-start mb-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{vital.label} Focus</span>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-7xl font-black tracking-tighter tabular-nums">{vital.value}</span>
            <span className="text-2xl font-bold opacity-60 uppercase">{vital.unit}</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
              {vital.status} reading
            </div>
            {pregnancyWeek && (
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Normal for week {pregnancyWeek}
              </span>
            )}
          </div>
        </div>

        <div className="p-10 space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Explanation</h4>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">{getExplanation()}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Why it matters</h4>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                Consistent readings in this range indicate good cardiovascular health and proper fetal support.
              </p>
            </div>
            <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
                  <Activity className="w-4 h-4" />
                </div>
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Recommended Action</p>
              </div>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">{getAction()}</p>
            </div>
          </div>

          {vital.status !== 'normal' && (
            <p className="text-center text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">
              ⚠️ This reading may impact your overall health score
            </p>
          )}

          <button 
            onClick={onClose}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
          >
            Back to Dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive />
      </LineChart>
    </ResponsiveContainer>
  );
}

const moodConfig: Record<string, { bg: string, border: string, text: string, icon: string }> = {
  emerald: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600", icon: "text-emerald-500" },
  blue: { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-600", icon: "text-blue-500" },
  amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600", icon: "text-amber-500" },
  gray: { bg: "bg-gray-50", border: "border-gray-100", text: "text-gray-600", icon: "text-gray-500" },
};

const DEFAULT_VITALS: Vital[] = [
  { id: 1, label: "Heart Rate", value: "--", unit: "bpm", status: "normal", trend: "stable", change: "0", history: [72, 75, 71, 78, 74, 76, 73], safeRange: { min: 60, max: 100 }, stability: "Stable" },
  { id: 2, label: "Blood Pressure", value: "--", unit: "mmHg", status: "normal", trend: "stable", change: "0", history: [118, 120, 115, 122, 119, 121, 117], safeRange: { min: 90, max: 140 }, stability: "Stable" },
  { id: 3, label: "SpO2", value: "--", unit: "%", status: "normal", trend: "stable", change: "0", history: [98, 99, 98, 97, 98, 99, 98], safeRange: { min: 95, max: 100 }, stability: "Stable" },
  { id: 4, label: "Temperature", value: "--", unit: "C", status: "normal", trend: "stable", change: "0", history: [36.5, 36.6, 36.4, 36.7, 36.5, 36.6, 36.5], safeRange: { min: 36.1, max: 37.2 }, stability: "Stable" },
  { id: 5, label: "Weight", value: "--", unit: "kg", status: "normal", trend: "stable", change: "0", history: [68.2, 68.4, 68.3, 68.5, 68.4, 68.6, 68.5], safeRange: { min: 45, max: 120 }, stability: "Stable" },
];

export default function Dashboard() {
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [loading, setLoading] = useState(true);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [focusedVital, setFocusedVital] = useState<Vital | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isHardwareStreaming, setIsHardwareStreaming] = useState(false);
  const hardwareStreamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fixedBpWeightRef = useRef<{ systolic: number; diastolic: number; weight: number }>({
    systolic: 118,
    diastolic: 76,
    weight: 56.0,
  });
  const stepCounterRef = useRef(0);
  const [liveStepCount, setLiveStepCount] = useState(0);
  const [dashboardData, setDashboardData] = useState({
    risk: { value: 0, level: "Low", change: 0, explanation: "Evaluating your health data...", lastUpdated: "Just now", breakdown: { vitals: 0, sleep: 0, hydration: 0, symptoms: 0 } },
    vitalsList: DEFAULT_VITALS,
    activeAlerts: [] as any[],
    hydration: { value: 0, goal: 2.5, unit: "L", pct: 0, status: "No intake logged", color: "gray" },
    sleep: { value: 0, unit: "hrs", quality: "-", pct: 0, status: "Not logged", color: "gray" },
    mood: { value: "Not logged", color: "gray", status: "Not logged", indicatorColor: "gray", pct: 0 },
    steps: { value: 0, status: "No steps yet", trend: "idle" as "idle" | "active" },
    performanceScore: 0,
    activityFeed: [] as any[],
    trends: [] as any[],
    rawVitals: [] as any[],
    aiGuidance: [] as GuidanceItem[],
    profile: { 
      pregnancy_week: null as number | null, 
      provider_name: "Dr. Priya Sharma", 
      full_name: null as string | null, 
      age: null as number | null, 
      due_date: null as string | null, 
      medical_history: null as any[] | null, 
      conditions: null as any | null 
    },
    overallInsight: "Analyzing your latest health signals...",
  });
  const renderSmartDot = (props: any, maxThreshold: number, minThreshold: number, color: string) => {
    const { cx, cy, value, key } = props;
    if (value === null || value === undefined) return <></>;
    
    const isAbnormal = value > maxThreshold || value < minThreshold;
    
    if (isAbnormal) {
      return (
        <circle 
          cx={cx} 
          cy={cy} 
          r={6} 
          fill={color} 
          stroke="white" 
          strokeWidth={2} 
          key={`abnormal-${key}-${cx}-${cy}`}
          className="animate-pulse drop-shadow-md origin-center"
        />
      );
    }
    return <></>;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/50 p-4 rounded-2xl shadow-2xl z-50 min-w-[160px]">
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-gray-700/50 pb-2">{label}</p>
          <div className="space-y-2.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center gap-6">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-300 text-[11px] font-bold">{entry.name.replace(/ \(Prev\)/, '')}</span>
                </span>
                <span className={`text-xs font-black tabular-nums ${entry.name.includes('(Prev)') ? 'text-gray-400' : 'text-white'}`}>
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const generateOverallInsight = (vitals: any, sleep: any, water: number, gestationalWeek: number) => {
    if (!vitals && !sleep && water === 0) return "No data yet. Start logging your vitals and daily habits to see your health summary.";
    
    const reasons: string[] = [];
    
    if (vitals) {
      if (Number(vitals.systolic_bp) >= 140) reasons.push("your blood pressure is higher than normal");
      if (Number(vitals.heart_rate) >= 100) reasons.push("your heart rate is elevated");
      if (Number(vitals.temperature) >= 38) reasons.push("you have a fever");
      if (Number(vitals.spo2) < 94) reasons.push("your oxygen levels are slightly low");
    }
    
    if (sleep && Number(sleep.sleep_hours) < 6) reasons.push("you are getting less sleep than recommended");
    if (water < 1.5) reasons.push("your hydration is lower than ideal");
    if (gestationalWeek >= 28) reasons.push("you are in a later stage of pregnancy which needs extra care");
    
    if (reasons.length === 0) {
      return "Your vitals and daily habits look stable. Keep maintaining your routine.";
    }
    
    // Combine top 2-3 reasons
    const topReasons = reasons.slice(0, 3);
    if (topReasons.length === 1) {
      const reason = topReasons[0];
      return reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
    }
    
    const lastReason = topReasons.pop();
    const combined = topReasons.join(", ") + " and " + lastReason;
    return combined.charAt(0).toUpperCase() + combined.slice(1) + ".";
  };

  const getPregnancyTrimester = useCallback((week: number | null) => {
    if (week === null) return "N/A";
    if (week < 13) return "First Trimester";
    if (week >= 13 && week <= 27) return "Second Trimester";
    if (week >= 28) return "Third Trimester";
    return "N/A";
  }, []);

  const chartData = useMemo(() => {
    const nowMs = Date.now();
    // rawVitals stored DESC (newest first) - we filter then reverse for chart display
    const rawVitals: any[] = (dashboardData as any).rawVitals || [];

    const hoursMap: Record<string, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
    const maxHours = hoursMap[period] ?? 24;

    const filtered = rawVitals.filter(v => {
      const diffHours = (nowMs - new Date(v.recorded_at).getTime()) / 3600000;
      return diffHours <= maxHours;
    });

    console.log(`[Trends] period=${period} | rawVitals=${rawVitals.length} | filtered=${filtered.length}`, filtered[0]?.recorded_at);

    if (filtered.length === 0) return [];

    // Reverse so chart goes oldest -> newest
    return [...filtered].reverse().map((r: any) => ({
      time: period === "24h"
        ? formatDistanceToNow(new Date(r.recorded_at), { addSuffix: true }).replace("about ", "")
        : format(new Date(r.recorded_at), "MMM d"),
      hr: r.heart_rate,
      systolic: r.systolic_bp,
      diastolic: r.diastolic_bp,
      spo2: r.spo2,
    }));
  }, [dashboardData.rawVitals, period]);

  const [compareMode, setCompareMode] = useState(false);
  const [trendPopup, setTrendPopup] = useState<any | null>(null);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [selectedFeedItem, setSelectedFeedItem] = useState<any | null>(null);

  const trendSummary = useMemo(() => {
    if (chartData.length < 2) return { text: "Vitals are stable", tag: "Stable", color: "emerald" };
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    const hrDiff = (last.hr || 0) - (first.hr || 0);
    
    if (Math.abs(hrDiff) > 10) return { text: "There is some fluctuation in your vitals", tag: "Fluctuating", color: "amber" };
    if (hrDiff < -2) return { text: "Your vitals are improving this week", tag: "Improving", color: "emerald" };
    if (hrDiff > 2) return { text: "Watching slight upward trends", tag: "Monitor", color: "blue" };
    return { text: "Vitals are perfectly stable", tag: "Stable", color: "emerald" };
  }, [chartData]);

  const generateSafeVitalsPayload = useCallback((userId: string) => {
    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomDecimal = (min: number, max: number, precision = 1) =>
      Number((Math.random() * (max - min) + min).toFixed(precision));
    const toFiniteOr = (value: unknown, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const stepIncrease = randomInt(10, 15);
    stepCounterRef.current += stepIncrease;
    setLiveStepCount(stepCounterRef.current);

    return {
      user_id: userId,
      source: "esp32",
      // These vitals change every push, but always within safe range.
      heart_rate: randomInt(72, 88),
      spo2: randomInt(96, 99),
      temperature: randomDecimal(36.3, 37.0, 1),
      // Keep BP and weight fixed while streaming.
      systolic_bp: toFiniteOr(fixedBpWeightRef.current.systolic, 118),
      diastolic_bp: toFiniteOr(fixedBpWeightRef.current.diastolic, 76),
      weight: toFiniteOr(fixedBpWeightRef.current.weight, 56.0),
      // Only steps increase by 10-15 each cycle.
      steps: stepCounterRef.current,
    };
  }, []);

  const stopHardwareStream = useCallback(() => {
    if (hardwareStreamRef.current) {
      clearInterval(hardwareStreamRef.current);
      hardwareStreamRef.current = null;
    }
    setIsHardwareStreaming(false);
  }, []);

  const isMissingVitalsColumn = (error: any, column: string) =>
    error?.code === "PGRST204" &&
    typeof error?.message === "string" &&
    error.message.includes("vitals") &&
    (error.message.includes(`'${column}'`) || error.message.includes(column));

  const pushSafeVitalsReading = useCallback(async () => {
    if (!user?.id) return false;
    const payload = generateSafeVitalsPayload(user.id);
    let { error } = await supabase.from("vitals").insert([payload]);

    if (error && isMissingVitalsColumn(error, "source")) {
      const fallbackPayload: any = { ...payload };
      delete fallbackPayload.source;
      const retry = await supabase.from("vitals").insert([fallbackPayload]);
      error = retry.error;
    }

    if (error && isMissingVitalsColumn(error, "steps")) {
      const fallbackPayload: any = { ...payload };
      delete fallbackPayload.steps;
      const retry = await supabase.from("vitals").insert([fallbackPayload]);
      error = retry.error;
    }

    // Handle environments where both "source" and "steps" are unavailable.
    if (error && (isMissingVitalsColumn(error, "source") || isMissingVitalsColumn(error, "steps"))) {
      const fallbackPayload: any = { ...payload };
      delete fallbackPayload.source;
      delete fallbackPayload.steps;
      const retry = await supabase.from("vitals").insert([fallbackPayload]);
      error = retry.error;
    }

    if (error) {
      console.error("Hardware stream insert failed:", error.message || error);
      return false;
    }
    return true;
  }, [generateSafeVitalsPayload, user?.id]);

  const handleHardwareToggle = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: "Login required",
        description: "Please sign in before connecting hardware.",
        variant: "destructive",
      });
      return;
    }

    if (isHardwareStreaming) {
      stopHardwareStream();
      toast({
        title: "Hardware disconnected",
        description: "Vital stream stopped successfully.",
      });
      return;
    }

    const { data: latestBeforeStart } = await supabase
      .from("vitals")
      .select("systolic_bp, diastolic_bp, weight, steps")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const safeNumber = (value: unknown, fallback: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    fixedBpWeightRef.current = {
      systolic: safeNumber(latestBeforeStart?.systolic_bp, 118),
      diastolic: safeNumber(latestBeforeStart?.diastolic_bp, 76),
      weight: safeNumber(latestBeforeStart?.weight, 56.0),
    };
    stepCounterRef.current = safeNumber(latestBeforeStart?.steps, 0);
    setLiveStepCount(stepCounterRef.current);

    const initialPushOk = await pushSafeVitalsReading();
    if (!initialPushOk) {
      toast({
        title: "Connection failed",
        description: "Could not send a reading to dashboard.",
        variant: "destructive",
      });
      return;
    }

    setIsHardwareStreaming(true);
    toast({
      title: "Hardware connected",
      description: "System connected with hardware. Live vitals started.",
    });

    hardwareStreamRef.current = setInterval(async () => {
      const ok = await pushSafeVitalsReading();
      if (!ok) {
        stopHardwareStream();
        toast({
          title: "Hardware stream stopped",
          description: "Connection lost while sending vitals.",
          variant: "destructive",
        });
      }
    }, 20000);
  }, [isHardwareStreaming, pushSafeVitalsReading, stopHardwareStream, toast, user?.id]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = user.id;
      const today = new Date().toISOString().split("T")[0];

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all required data in parallel
      const [
        { data: last2Vitals, error: vitalsError },
        { data: latestAlerts },
        { data: waterDataToday, error: waterError },
        { data: sleepDataToday },
        { data: latestMood },
        { data: symptomsDataLatest },
        { data: allVitalsForTrends },
        { data: userProfile, error: profileError },
        // Activity Feed Data
        { data: activityVitals },
        { data: activityFood },
        { data: activityWater },
        { data: activitySleep },
        { data: activityMood }
      ] = await Promise.all([
        supabase.from("vitals").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(2),
        supabase.from("alerts")
          .select("*")
          .eq("user_id", userId)
          .eq("is_read", false)
          .gte("created_at", tenMinutesAgo) // Only fetch unread alerts from last 10 minutes
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("water_intake")
          .select("amount_liters")
          .eq("user_id", userId)
          .gte("recorded_at", `${today}T00:00:00`)
          .lte("recorded_at", `${today}T23:59:59`),
        supabase.from("sleep_data").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("mood_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("symptoms").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(5),
        supabase.from("vitals").select("*").eq("user_id", userId).gte("recorded_at", thirtyDaysAgo).order("recorded_at", { ascending: false }).limit(100),
        supabase.from("users").select("full_name, age, gestational_week, due_date, medical_history, doctor_name, conditions").eq("id", userId).maybeSingle(),
        // Activity Feed Fetching
        supabase.from("vitals").select("*").eq("user_id", userId).gte("recorded_at", fiveDaysAgo).order("recorded_at", { ascending: false }).limit(20),
        supabase.from("food_logs").select("*").eq("user_id", userId).gte("logged_at", fiveDaysAgo).order("logged_at", { ascending: false }).limit(20),
        supabase.from("water_intake").select("*").eq("user_id", userId).gte("recorded_at", fiveDaysAgo).order("recorded_at", { ascending: false }).limit(20),
        supabase.from("sleep_data").select("*").eq("user_id", userId).gte("recorded_at", fiveDaysAgo).order("recorded_at", { ascending: false }).limit(20),
        supabase.from("mood_logs").select("*").eq("user_id", userId).gte("created_at", fiveDaysAgo).order("created_at", { ascending: false }).limit(20)
      ]);

      if (vitalsError) console.error("VITALS ERROR:", vitalsError);
      if (waterError) console.error("HYDRATION ERROR:", waterError);
      if (profileError) console.error("PROFILE ERROR:", profileError);

      console.log("[Dashboard] Vitals fetched:", last2Vitals);

      const latestVitals = last2Vitals?.[0] || null;
      const vitalsRows = (allVitalsForTrends || []) as any[];

      // Use latest non-null value per field instead of assuming the newest row has all vitals.
      const latestFieldValue = (field: string) => {
        const row = vitalsRows.find((r) => r?.[field] !== null && r?.[field] !== undefined);
        return row ? Number(row[field]) : null;
      };
      const toFiniteOrNull = (value: unknown) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };

      const latestHeartRate = latestFieldValue("heart_rate");
      const latestSpo2 = latestFieldValue("spo2");
      const latestTemperature = latestFieldValue("temperature");
      const latestWeight = latestFieldValue("weight");
      const latestBpRow = vitalsRows.find((r) => r?.systolic_bp != null && r?.diastolic_bp != null) || null;
      const latestSystolicBp = latestBpRow ? Number(latestBpRow.systolic_bp) : null;
      const latestDiastolicBp = latestBpRow ? Number(latestBpRow.diastolic_bp) : null;

      // 1. Process Risk Score (Frontend Weighted Calculation)
      const totalAmount = Number(
        (waterDataToday || []).reduce(
          (sum, row) => sum + Number(row.amount_liters || 0),
          0
        ).toFixed(1)
      );
      
      const healthData: RiskHealthData = {
        heart_rate: latestHeartRate ?? undefined,
        bp_systolic: latestSystolicBp ?? undefined,
        bp_diastolic: latestDiastolicBp ?? undefined,
        spo2: latestSpo2 ?? undefined,
        temperature: latestTemperature ?? undefined,
        sleep_hours: sleepDataToday?.sleep_hours,
        water_intake: totalAmount,
        water_goal: 2.5,
        symptoms_count: symptomsDataLatest?.length || 0,
        gestational_week: userProfile?.gestational_week || 32
      };

      const calculatedRisk = calculateRiskScore(healthData);
      const hasSignals =
        latestHeartRate != null ||
        latestSystolicBp != null ||
        latestDiastolicBp != null ||
        latestSpo2 != null ||
        latestTemperature != null ||
        totalAmount > 0 ||
        (sleepDataToday?.sleep_hours != null) ||
        (symptomsDataLatest?.length || 0) > 0;

      const risk = {
        value: calculatedRisk.score,
        level: calculatedRisk.level,
        change: -2, 
        explanation:
          hasSignals && calculatedRisk.score === 0
            ? "No elevated risk detected from your latest logs."
            : "Based on your latest vitals and daily logs",
        lastUpdated: latestVitals?.recorded_at ? formatDistanceToNow(new Date(latestVitals.recorded_at)) + " ago" : "Just now",
        breakdown: {
          vitals: Math.min(Math.floor(calculatedRisk.score * 0.6), 40),
          sleep: Math.min(Math.floor(calculatedRisk.score * 0.15), 20),
          hydration: Math.min(Math.floor(calculatedRisk.score * 0.15), 20),
          symptoms: Math.min(Math.floor(calculatedRisk.score * 0.1), 20)
        }
      };

      // 2. Process Vitals
      const buildHistory = (field: string) => {
        const rows = vitalsRows
          .filter((r: any) => r[field] != null)
          .slice(0, 5)
          .reverse(); 
        return {
          values: rows.map((r: any) => Number(r[field])),
          timestamps: rows.map((r: any) => r.recorded_at as string),
        };
      };

      const vitalsList = DEFAULT_VITALS.map(v => {
        let val: string | number = "--";
        let status: "normal" | "warning" | "critical" = "normal";
        let change: string | number = "0";
        let trend: "up" | "down" | "stable" = "stable";
        let history: number[] = v.history; 
        let historyTimestamps: string[] = [];

        if (!latestVitals) return { ...v, value: "No data yet", change: "0", trend: "stable", status: "normal" };

        if (v.label === "Heart Rate") {
          const hr = latestHeartRate ?? toFiniteOrNull(latestVitals.heart_rate);
          val = hr ?? "--";
          if (hr == null) status = "normal";
          else if (hr > 110 || hr < 50) status = "critical";
          else if (hr > 100 || hr < 60) status = "warning";
          else status = "normal";

          const h = buildHistory("heart_rate");
          history = h.values.length > 0 ? h.values : v.history;
          historyTimestamps = h.timestamps;

          if (vitalsRows.length > 0) {
            const hrValues = vitalsRows.map(r => r.heart_rate).filter((v: any) => v != null);
            const avg = hrValues.length > 0 ? hrValues.reduce((a: number, b: number) => a + b, 0) / hrValues.length : hr;
            const deviation = ((hr - avg) / (avg || 1)) * 100;
            change = `${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}%`;
            trend = deviation > 0 ? "up" : deviation < 0 ? "down" : "stable";
          }
        }
        if (v.label === "Blood Pressure") {
          const sys = latestSystolicBp ?? toFiniteOrNull(latestVitals.systolic_bp);
          const dia = latestDiastolicBp ?? toFiniteOrNull(latestVitals.diastolic_bp);
          val = (sys != null && dia != null) ? `${sys}/${dia}` : "--";
          if (sys == null || dia == null) status = "normal";
          else if (sys >= 150 || dia >= 100) status = "critical";
          else if (sys >= 140 || dia >= 90) status = "warning";
          else status = "normal";

          const h = buildHistory("systolic_bp");
          history = h.values.length > 0 ? h.values : v.history;
          historyTimestamps = h.timestamps;

          if (vitalsRows.length > 0) {
            const sysValues = vitalsRows.map(r => r.systolic_bp).filter((v: any) => v != null);
            const avg = sysValues.length > 0 ? sysValues.reduce((a: number, b: number) => a + b, 0) / sysValues.length : sys;
            const deviation = ((sys - avg) / (avg || 1)) * 100;
            change = `${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}%`;
            trend = deviation > 0 ? "up" : deviation < 0 ? "down" : "stable";
          }
        }
        if (v.label === "SpO2") {
          const s = latestSpo2 ?? toFiniteOrNull(latestVitals.spo2);
          val = s ?? "--";
          if (s == null) status = "normal";
          else if (s < 90) status = "critical";
          else if (s <= 93) status = "warning";
          else status = "normal";

          const h = buildHistory("spo2");
          history = h.values.length > 0 ? h.values : v.history;
          historyTimestamps = h.timestamps;
        }
        if (v.label === "Temperature") {
          const t = latestTemperature ?? toFiniteOrNull(latestVitals.temperature);
          val = t ?? "--";
          if (t == null) status = "normal";
          else if (t >= 39) status = "critical";
          else if (t >= 37.5) status = "warning";
          else status = "normal";
        }
        if (v.label === "Weight") {
          const w = latestWeight ?? toFiniteOrNull(latestVitals.weight);
          val = w ?? "--";
          status = "normal";
        }

        return { ...v, value: val, status, change, trend, history, historyTimestamps } as any;
      });

      // 3. Process Alerts
      let activeAlerts = latestAlerts ? latestAlerts.map(a => ({
        id: a.id,
        severity: a.severity || "info",
        title: a.title,
        description: a.description,
        time: formatDistanceToNow(new Date(a.created_at)) + " ago",
        resolved: a.is_read,
        created_at: a.created_at
      })) : [];

      const severityMapDash: Record<string, number> = { immediate: 0, high: 1, monitor: 2 };
      activeAlerts.sort((a, b) => {
        const sevA = severityMapDash[a.severity] ?? 3;
        const sevB = severityMapDash[b.severity] ?? 3;
        if (sevA !== sevB) return sevA - sevB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // 4. Process Daily Metrics
      let hydrationStatus = "No intake logged";
      let hydrationColor = "gray";
      if (totalAmount > 0) {
        if (totalAmount < 1.5) {
          hydrationStatus = "Low hydration";
          hydrationColor = "red";
        } else if (totalAmount < 2.5) {
          hydrationStatus = "Moderate";
          hydrationColor = "yellow";
        } else {
          hydrationStatus = "Well hydrated";
          hydrationColor = "green";
        }
      }

      const hydration = {
        value: totalAmount,
        goal: 2.5,
        unit: "L",
        pct: Math.min(Math.round((totalAmount / 2.5) * 100), 100),
        status: hydrationStatus,
        color: hydrationColor
      };

      let sleepStatus = "Not logged";
      let sleepColor = "gray";
      const sleepValue = sleepDataToday ? sleepDataToday.sleep_hours : 0;
      
      if (sleepValue > 0) {
        if (sleepValue < 5) {
          sleepStatus = "Very low sleep";
          sleepColor = "red";
        } else if (sleepValue < 6) {
          sleepStatus = "Below recommended";
          sleepColor = "yellow";
        } else if (sleepValue <= 8) {
          sleepStatus = "Good sleep";
          sleepColor = "green";
        } else {
          sleepStatus = "Oversleep";
          sleepColor = "yellow";
        }
      }

      const sleep = {
        value: sleepValue,
        unit: "hrs",
        quality: sleepDataToday?.sleep_quality || "No data",
        pct: Math.min(Math.round((sleepValue / 8) * 100), 100),
        status: sleepStatus,
        color: sleepColor
      };

      let moodStatus = "Not logged";
      let moodColor = "gray";
      let moodIndicatorColor = "gray";
      const moodValue = latestMood ? String(latestMood.mood || "").trim().toLowerCase() : "";

      if (moodValue) {
        if (["happy", "good", "great", "excellent", "calm"].includes(moodValue)) {
          moodStatus = "Feeling positive";
          moodColor = "emerald";
          moodIndicatorColor = "green";
        } else if (moodValue === "neutral") {
          moodStatus = "Stable";
          moodColor = "blue";
          moodIndicatorColor = "yellow";
        } else {
          moodStatus = "Needs attention";
          moodColor = "amber";
          moodIndicatorColor = "amber";
        }
      }

      let moodScore = 0;
      if (["happy", "good", "great", "excellent", "calm"].includes(moodValue)) moodScore = 100;
      else if (moodValue === "neutral") moodScore = 60;
      else if (moodValue !== "") moodScore = 30;

      const performanceScore = Math.round((hydration.pct + sleep.pct + moodScore) / 3);

      const latestStepsRow = (allVitalsForTrends || []).find((r: any) => r?.steps != null);
      const latestSteps = Number(latestStepsRow?.steps || 0);
      const effectiveSteps = latestSteps > 0 ? latestSteps : liveStepCount;
      const steps = {
        value: effectiveSteps,
        status: effectiveSteps > 0 ? "Counting steps" : "No steps yet",
        trend: effectiveSteps > 0 ? "active" as const : "idle" as const,
      };

      const mood = {
        value: latestMood ? latestMood.mood : "Not logged",
        color: moodColor,
        status: moodStatus,
        indicatorColor: moodIndicatorColor,
        pct: moodScore
      };

      // 5. Activity Feed
      const newFeed: any[] = [];
      
      if (activityVitals) {
        activityVitals.forEach(v => {
          newFeed.push({
            id: `v-${v.id}`,
            type: "vitals",
            title: "Vitals updated",
            description: `HR: ${v.heart_rate || '--'} bpm, BP: ${v.systolic_bp || '--'}/${v.diastolic_bp || '--'}, SpO2: ${v.spo2 || '--'}%`,
            timestamp: new Date(v.recorded_at).getTime(),
            rawDate: new Date(v.recorded_at)
          });
        });
      }

      if (activityFood) {
        activityFood.forEach(f => {
          newFeed.push({
            id: `f-${f.id}`,
            type: "meal",
            title: "Meal logged",
            description: `${f.meal_type} - ${f.food_name}`,
            timestamp: new Date(f.logged_at).getTime(),
            rawDate: new Date(f.logged_at)
          });
        });
      }

      const dailyLogsByDate: Record<string, any> = {};
      const addToDailyLog = (dateStr: string, key: string, value: any, rawDate: Date) => {
        if (!dailyLogsByDate[dateStr]) {
          dailyLogsByDate[dateStr] = { sleep: '--', water: '--', mood: '--', rawDate };
        }
        dailyLogsByDate[dateStr][key] = value;
      };

      if (activitySleep) {
        activitySleep.forEach(s => {
          const d = new Date(s.recorded_at);
          addToDailyLog(d.toISOString().split('T')[0], 'sleep', s.sleep_hours, d);
        });
      }
      
      if (activityWater) {
        activityWater.forEach(w => {
          const d = new Date(w.recorded_at);
          const dateStr = d.toISOString().split('T')[0];
          if (!dailyLogsByDate[dateStr]) {
            dailyLogsByDate[dateStr] = { sleep: '--', water: 0, mood: '--', rawDate: d };
          }
          if (dailyLogsByDate[dateStr].water === '--') dailyLogsByDate[dateStr].water = 0;
          dailyLogsByDate[dateStr].water += Number(w.amount_liters || 0);
        });
      }

      if (activityMood) {
        activityMood.forEach(m => {
          const d = new Date(m.created_at);
          addToDailyLog(d.toISOString().split('T')[0], 'mood', m.mood, d);
        });
      }

      Object.keys(dailyLogsByDate).forEach(dateStr => {
        const log = dailyLogsByDate[dateStr];
        const waterStr = typeof log.water === 'number' ? log.water.toFixed(1) : log.water;
        newFeed.push({
          id: `d-${dateStr}`,
          type: "log",
          title: "Daily log updated",
          description: `Sleep: ${log.sleep}h, Water: ${waterStr}L, Mood: ${log.mood}`,
          timestamp: log.rawDate.getTime(),
          rawDate: log.rawDate
        });
      });

      const groupedActivities: Record<string, any> = {}; 
      newFeed.forEach((item: any) => {
        const dateKey = format(item.rawDate, "yyyy-MM-dd");
        const groupKey = `${dateKey}_${item.type}`;
        if (!groupedActivities[groupKey]) {
          groupedActivities[groupKey] = {
            type: item.type, title: item.title, description: item.description,
            timestamp: item.timestamp, rawDate: item.rawDate, count: 0, items: []
          };
        }
        groupedActivities[groupKey].count++;
        groupedActivities[groupKey].items.push(item);
        if (item.timestamp > groupedActivities[groupKey].timestamp) {
          groupedActivities[groupKey].timestamp = item.timestamp;
          groupedActivities[groupKey].rawDate = item.rawDate;
        }
      });

      const summarizedFeed = Object.values(groupedActivities).map((group: any) => {
        if (group.count > 1) {
          let title = "";
          if (group.type === "vitals") title = "Vitals updated";
          else if (group.type === "meal") title = "Meals logged";
          else if (group.type === "log") title = "Daily logs updated";
          return {
            id: `${group.type}-${format(group.rawDate, "yyyy-MM-dd")}`,
            type: group.type, title: title, description: `${title} ${group.count} times today`,
            timestamp: group.timestamp, rawDate: group.rawDate, isGrouped: true
          };
        }
        return group.items[0];
      });

      const groupedFeed: any[] = [];
      const finalSortedFeed = summarizedFeed.sort((a: any, b: any) => b.timestamp - a.timestamp);
      const todayArr: any[] = [];
      const yesterdayArr: any[] = [];
      const earlierArr: any[] = [];

      finalSortedFeed.forEach(item => {
        let timeStr = "";
        const diffMs = Date.now() - item.timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 60) timeStr = diffMins <= 1 ? "Just now" : `${diffMins} mins ago`;
        else if (diffHours < 24 && isToday(item.rawDate)) timeStr = `${diffHours} hours ago`;
        else if (isYesterday(item.rawDate)) timeStr = `Yesterday ${format(item.rawDate, "h:mm a")}`;
        else timeStr = format(item.rawDate, "MMM d, h:mm a");

        item.time = timeStr;
        if (isToday(item.rawDate)) todayArr.push(item);
        else if (isYesterday(item.rawDate)) yesterdayArr.push(item);
        else earlierArr.push(item);
      });

      if (todayArr.length > 0) groupedFeed.push({ header: "Today", items: todayArr });
      if (yesterdayArr.length > 0) groupedFeed.push({ header: "Yesterday", items: yesterdayArr });
      if (earlierArr.length > 0) groupedFeed.push({ header: "Earlier", items: earlierArr });

      // 6. Trends & Profile
      const trends = allVitalsForTrends ? allVitalsForTrends.map((r: any) => ({
        time: period === "24h" 
          ? formatDistanceToNow(new Date(r.recorded_at), { addSuffix: true }).replace("about ", "")
          : format(new Date(r.recorded_at), "MMM d"),
        hr: r.heart_rate, systolic: r.systolic_bp, diastolic: r.diastolic_bp, spo2: r.spo2
      })) : [];

      const guidanceInput: UserHealthData = {
        latest: {
          heart_rate: latestVitals?.heart_rate,
          bp_systolic: latestVitals?.systolic_bp,
          bp_diastolic: latestVitals?.diastolic_bp,
          spo2: latestVitals?.spo2,
          temperature: latestVitals?.temperature,
          sleep_hours: sleepDataToday?.sleep_hours,
          water_intake: totalAmount,
        },
        history: (allVitalsForTrends || []).map((v: any) => ({
          heart_rate: v.heart_rate, systolic_bp: v.systolic_bp, diastolic_bp: v.diastolic_bp,
          spo2: v.spo2, temperature: v.temperature, recorded_at: v.recorded_at
        })),
        pregnancy: {
          gestational_week: userProfile?.gestational_week,
          age: userProfile?.age,
          medical_conditions: userProfile?.conditions ? [userProfile.conditions] : []
        }
      };

      const guidanceResult = generateGuidance(guidanceInput);
      const aiGuidance = [guidanceResult.topPriority, guidanceResult.secondary].filter((i): i is GuidanceItem => i !== null);
      const overallInsight = generateOverallInsight(latestVitals, sleepDataToday, totalAmount, userProfile?.gestational_week || 32);

      const profile = {
        pregnancy_week: userProfile?.gestational_week ?? null,
        provider_name: userProfile?.doctor_name ?? "Dr. Priya Sharma",
        full_name: userProfile?.full_name ?? null,
        age: userProfile?.age ?? null,
        due_date: userProfile?.due_date ?? null,
        medical_history: userProfile?.medical_history ?? null,
        conditions: userProfile?.conditions ?? null,
      };

      setDashboardData({
        risk,
        vitalsList,
        activeAlerts,
        hydration,
        sleep,
        mood,
        steps,
        performanceScore,
        activityFeed: groupedFeed,
        trends,
        rawVitals: allVitalsForTrends || [],
        aiGuidance,
        profile,
        overallInsight,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [liveStepCount, user]); // Removed period dependency

  useEffect(() => {
    fetchDashboardData();
    if (!user?.id) return;

    // Realtime subscriptions
    const channel = supabase
      .channel(`dashboard-realtime-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vitals', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vitals', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'water_intake', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'water_intake', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sleep_data', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sleep_data', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'symptoms', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'symptoms', filter: `user_id=eq.${user.id}` }, () => fetchDashboardData())
      .subscribe();

    // Fallback sync: keeps UI live even if websocket events drop.
    const pollRef = setInterval(() => {
      fetchDashboardData();
    }, 5000);

    return () => {
      clearInterval(pollRef);
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData, user?.id]);

  useEffect(() => {
    return () => {
      if (hardwareStreamRef.current) {
        clearInterval(hardwareStreamRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Health Risk Detail Modal */}
      <AnimatePresence>
        {isRiskModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100"
            >
              {/* Modal Header */}
              <div className={`relative p-8 text-white ${
                dashboardData.risk.level === "Low" ? "bg-emerald-600" : 
                dashboardData.risk.level === "Moderate" ? "bg-amber-500" : 
                "bg-red-600"
              }`}>
                <button 
                  onClick={() => setIsRiskModalOpen(false)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <div className="relative z-10 flex items-center gap-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-7xl font-black tracking-tighter tabular-nums">
                      <AnimatedScore value={dashboardData.risk.value} />
                    </span>
                    <span className="text-2xl opacity-60 font-bold">/ 100</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black leading-tight">{dashboardData.risk.level} Risk Level</h3>
                    <p className="text-white/80 text-sm font-medium mt-1 uppercase tracking-widest">Health Analysis Summary</p>
                  </div>
                </div>
                
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              </div>

              {/* Modal Content */}
              <div className="p-10 space-y-8">
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Risk Factor Breakdown</h4>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: "Vitals", value: dashboardData.risk.breakdown.vitals, icon: Activity, color: "blue", max: 40 },
                      { label: "Sleep", value: dashboardData.risk.breakdown.sleep, icon: Moon, color: "purple", max: 20 },
                      { label: "Hydration", value: dashboardData.risk.breakdown.hydration, icon: Droplets, color: "cyan", max: 20 },
                      { label: "Symptoms", value: dashboardData.risk.breakdown.symptoms, icon: Zap, color: "amber", max: 20 },
                    ].map((factor) => (
                      <div key={factor.label} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2">
                            <factor.icon className={`w-3.5 h-3.5 text-${factor.color}-500`} />
                            <span className="text-xs font-bold text-gray-700">{factor.label}</span>
                          </div>
                          <span className="text-xs font-black text-gray-900">{factor.value} pts</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(factor.value / factor.max) * 100}%` }}
                            className={`h-full rounded-full bg-${factor.color}-500`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs font-black text-gray-900 uppercase tracking-widest">How to improve</p>
                  </div>
                  <ul className="space-y-2">
                    <li className="text-xs text-gray-600 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      Maintain consistent hydration (2.5L daily goal)
                    </li>
                    <li className="text-xs text-gray-600 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      Aim for 7-8 hours of restful sleep tonight
                    </li>
                    <li className="text-xs text-gray-600 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      Log any new symptoms as they occur for better tracking
                    </li>
                  </ul>
                </div>

                <p className="text-center text-[10px] font-medium text-gray-400 italic">
                  "Your score is based on recent vitals and daily logs"
                </p>

                <button 
                  onClick={() => setIsRiskModalOpen(false)}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
                >
                  Got it, thanks
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">Actively monitoring your vitals and health status.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleHardwareToggle}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm border ${
              isHardwareStreaming
                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            {isHardwareStreaming ? "Stop Hardware" : "Connect Hardware"}
          </button>
          <ManualVitalsInput onSuccess={fetchDashboardData} />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isHardwareStreaming ? "bg-emerald-400 animate-pulse" : "bg-gray-300"}`} />
              {isHardwareStreaming ? "Hardware Active" : "Monitoring Active"}
            </span>
            <span className="text-gray-300">.</span>
            <span>Last sync: {loading ? "Syncing..." : "Just now"}</span>
          </div>
        </div>
      </div>

      {/* Hero + Do This Now */}
      <div className="grid grid-cols-3 gap-4">
        {/* Risk card */}
        <motion.div 
          whileHover={{ scale: 1.01, translateY: -2 }}
          onClick={() => setIsRiskModalOpen(true)}
          className={`col-span-2 card p-6 cursor-pointer transition-all duration-300 relative overflow-hidden group
            ${dashboardData.risk.level === "Low" ? "border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 hover:shadow-emerald-100/50" : 
              dashboardData.risk.level === "Moderate" ? "border-amber-100 bg-gradient-to-br from-white to-amber-50/30 hover:shadow-amber-100/50" : 
              "border-red-100 bg-gradient-to-br from-white to-red-50/30 hover:shadow-red-100/50"}
            shadow-sm hover:shadow-xl`}
        >
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${
                dashboardData.risk.level === "Low" ? "bg-emerald-100 text-emerald-600" : 
                dashboardData.risk.level === "Moderate" ? "bg-amber-100 text-amber-600" : 
                "bg-red-100 text-red-600"
              }`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-gray-900 tracking-tight uppercase">Health Risk Score</span>
                  <div className="group/tip relative">
                    <Info className="w-3.5 h-3.5 text-gray-300 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-all w-48 text-center shadow-xl z-20 leading-relaxed">
                      This score is calculated using vitals, sleep, hydration, and symptoms.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Real-time Analysis</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                dashboardData.risk.level === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                dashboardData.risk.level === "Moderate" ? "bg-amber-50 text-amber-600 border-amber-100" : 
                "bg-red-50 text-red-600 border-red-100"
              }`}>
                {dashboardData.risk.level} Risk
              </div>
              {dashboardData.risk.change !== 0 && (
                <div className={`flex items-center gap-1 text-[10px] font-black ${dashboardData.risk.change < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {dashboardData.risk.change < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {Math.abs(dashboardData.risk.change)}% {dashboardData.risk.change < 0 ? 'Improved' : 'Increased risk'}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-end gap-6 mb-8 relative z-10">
            <div className="flex items-baseline gap-2">
              <span className="text-7xl font-black text-gray-900 tracking-tighter tabular-nums drop-shadow-sm">
                <AnimatedScore value={dashboardData.risk.value} />
              </span>
              <span className="text-2xl text-gray-300 font-black tracking-tight">/ 100</span>
            </div>
            
            <div className="flex-1 max-w-[200px] pb-3">
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${dashboardData.risk.value}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    dashboardData.risk.level === "Low" ? "bg-emerald-500" : 
                    dashboardData.risk.level === "Moderate" ? "bg-amber-500" : 
                    "bg-red-500"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between relative z-10 pt-6 border-t border-gray-100/50">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[Heart, Wind, Droplets, Moon].map((Icon, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-white border-2 border-gray-50 flex items-center justify-center text-gray-400 shadow-sm">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 font-medium">Multidimensional data sync active</p>
            </div>
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold group-hover:gap-3 transition-all">
              Details Breakdown {"->"} <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Decorative background elements */}
          <div className={`absolute top-0 right-0 w-64 h-64 opacity-[0.03] -translate-y-1/2 translate-x-1/4 rounded-full blur-3xl pointer-events-none ${
            dashboardData.risk.level === "Low" ? "bg-emerald-600" : 
            dashboardData.risk.level === "Moderate" ? "bg-amber-600" : 
            "bg-red-600"
          }`} />
        </motion.div>

        {/* Priority Actions - Do This Now */}
        <Link href="/analytics" className="block no-underline h-full">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.015, translateY: -2 }}
            className={`h-full card p-6 cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between
              ${!dashboardData.aiGuidance[0] || dashboardData.aiGuidance[0].severity === 'low' ? 'bg-gradient-to-br from-white to-emerald-50/10 border-emerald-100 hover:shadow-emerald-100/20' : 
                dashboardData.aiGuidance[0].severity === 'high' ? 'bg-gradient-to-br from-white to-red-50/10 border-red-100 hover:shadow-red-100/20' : 
                'bg-gradient-to-br from-white to-amber-50/10 border-amber-100 hover:shadow-amber-100/20'}
              shadow-sm hover:shadow-xl group`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Guidance Action</p>
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Updated just now</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                  !dashboardData.aiGuidance[0] || dashboardData.aiGuidance[0].severity === 'low' ? 'bg-emerald-500 text-white border-emerald-400' : 
                  dashboardData.aiGuidance[0].severity === 'high' ? 'bg-red-500 text-white border-red-400' : 
                  'bg-amber-500 text-white border-amber-400'
                }`}>
                  {!dashboardData.aiGuidance[0] ? 'Stable' : 
                   dashboardData.aiGuidance[0].severity === 'high' ? 'Urgent' : 
                   dashboardData.aiGuidance[0].severity === 'medium' ? 'Attention' : 'Stable'}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                  {dashboardData.aiGuidance[0]?.title || "Everything looks stable"}
                </h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">
                  {dashboardData.aiGuidance[0]?.description || "Keep maintaining your routine."}
                </p>
              </div>
            </div>

            <div className="relative z-10 pt-6 mt-auto">
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-xs font-black uppercase tracking-widest group-hover:underline">View detailed analysis {"->"}</span>
                <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all group-hover:translate-x-1">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Decorative soft glow */}
            <div className={`absolute -bottom-10 -right-10 w-40 h-40 opacity-[0.03] rounded-full blur-3xl pointer-events-none ${
              !dashboardData.aiGuidance[0] || dashboardData.aiGuidance[0].severity === 'low' ? 'bg-emerald-600' : 
              dashboardData.aiGuidance[0].severity === 'high' ? 'bg-red-600' : 
              'bg-amber-600'
            }`} />
          </motion.div>
        </Link>
      </div>

      {/* Health Summary block */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        layout
        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
        className="p-7 bg-white border border-gray-100 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.08)] hover:bg-gray-50/50 hover:-translate-y-0.5 cursor-pointer transition-all duration-300 group"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Health Summary</h2>
            <Link href="/ai-guidance" onClick={(e) => e.stopPropagation()} className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600 transition-colors uppercase tracking-widest no-underline">
              View full guidance {"->"}
            </Link>
          </div>
          
          <div className="max-w-2xl">
            <p className="text-lg font-medium text-gray-900 leading-relaxed line-clamp-2">
              {dashboardData.risk.level === "Low" 
                ? "Your vitals are stable and within a healthy range. Continue your routine and keep monitoring regularly."
                : "Some of your readings need attention. It's a good time to review your current habits."
              }
            </p>
            
            <AnimatePresence>
              {isSummaryExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-sm text-gray-500 font-medium pt-3 border-t border-gray-100">
                    AI can help you understand this better based on your complete health data.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Vitals grid */}
      <div className="space-y-4">
        {dashboardData.vitalsList.every(v => v.value === "--" || v.value === "No data yet") ? (
          <div className="card p-12 flex flex-col items-center justify-center text-center bg-gray-50/50 border-dashed border-2 border-gray-200">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight mb-2">No recent data available</h3>
            <p className="text-sm text-gray-500 font-medium max-w-xs mb-6">Log vitals to see insights, trends, and personalized pregnancy monitoring.</p>
            <ManualVitalsInput onSuccess={fetchDashboardData} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Body Status</h2>
                  <div className="h-1 w-1 rounded-full bg-gray-300" />
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      dashboardData.vitalsList.some(v => v.status === 'critical') ? 'bg-red-500' :
                      dashboardData.vitalsList.some(v => v.status === 'warning') ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {dashboardData.vitalsList.some(v => v.status === 'critical') ? 'Action Required' :
                       dashboardData.vitalsList.some(v => v.status === 'warning') ? 'Monitoring' :
                       'All Stable'}
                    </span>
                  </div>
                </div>
                <p className="text-xl font-black text-gray-900 tracking-tight">
                  {(() => {
                    const criticalCount = dashboardData.vitalsList.filter(v => v.status === 'critical').length;
                    const warningCount = dashboardData.vitalsList.filter(v => v.status === 'warning').length;
                    if (criticalCount > 0) return "Multiple vitals need immediate attention";
                    if (warningCount > 1) return "Several vitals are slightly elevated";
                    if (warningCount === 1) {
                      const vital = dashboardData.vitalsList.find(v => v.status === 'warning');
                      return `${vital?.label} is slightly elevated`;
                    }
                    return "All vitals are stable today";
                  })()}
                </p>
              </div>
              <Link href="/vitals" className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest transition-colors border border-gray-100">
                Full Report {"->"}
              </Link>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {dashboardData.vitalsList.map((v) => (
                <VitalCard 
                  key={v.id} 
                  vital={v} 
                  onClick={() => setFocusedVital(v)}
                  isProblematic={v.status !== 'normal'}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {focusedVital && (
          <VitalFocusModal 
            vital={focusedVital} 
            pregnancyWeek={dashboardData.profile.pregnancy_week}
            onClose={() => setFocusedVital(null)}
          />
        )}
      </AnimatePresence>

      {/* Trend graph + Alert preview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card p-6 card-hover relative group flex flex-col overflow-hidden">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Vital Trends</h2>
                {chartData.length >= 2 && (
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border bg-${trendSummary.color}-50 text-${trendSummary.color}-600 border-${trendSummary.color}-100`}>
                    {trendSummary.tag}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-gray-800">
                {chartData.length >= 2 ? trendSummary.text : "Log more vitals to see trends"}
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-3 z-10">
              <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100">
                {(["24h", "7d", "30d"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={`text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-lg transition-all ${period === p ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>{p}</button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer" onClick={() => setCompareMode(!compareMode)}>Compare</span>
                <button 
                  onClick={() => setCompareMode(!compareMode)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${compareMode ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <motion.div 
                    initial={false} 
                    animate={{ x: compareMode ? 16 : 2 }} 
                    className="w-3 h-3 bg-white rounded-full absolute top-0.5 shadow-sm"
                  />
               </button>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[200px] relative z-0">
            <AnimatePresence mode="wait">
              {chartData.length > 0 ? (
                <motion.div
                  key={period + "-" + compareMode}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={chartData} 
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      onMouseLeave={() => setTrendPopup(null)}
                      onClick={(e) => {
                        if (e && e.activePayload && e.activePayload.length > 0) {
                           const payload = e.activePayload[0];
                           setTrendPopup({
                             x: e.chartX,
                             y: e.chartY,
                             value: payload.value,
                             name: payload.name,
                             time: payload.payload.time
                           });
                        } else {
                           setTrendPopup(null);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#9ca3af", fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fontSize: 9, fill: "#9ca3af", fontWeight: 700 }} axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      
                      {compareMode && (
                        <Area 
                          type="natural" 
                          dataKey={(d) => d.hr ? d.hr * 0.9 : 0} 
                          stroke="#cbd5e1" 
                          fill="none"
                          strokeWidth={2} 
                          strokeDasharray="4 4"
                          name="Heart Rate (Prev)" 
                          dot={false}
                          activeDot={false}
                        />
                      )}

                      <Area 
                        type="natural" 
                        dataKey="hr" 
                        stroke="#3b82f6" 
                        fill="url(#hrGrad)" 
                        strokeWidth={2.5} 
                        dot={(props) => renderSmartDot(props, 100, 50, '#3b82f6')} 
                        activeDot={{ r: 6, strokeWidth: 2, fill: "#fff", stroke: "#3b82f6" }}
                        name="Heart Rate" 
                      />
                      <Area 
                        type="natural" 
                        dataKey="systolic" 
                        stroke="#8b5cf6" 
                        fill="none" 
                        strokeWidth={2} 
                        dot={(props) => renderSmartDot(props, 140, 90, '#8b5cf6')} 
                        activeDot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "#8b5cf6" }}
                        name="Systolic BP" 
                      />
                      <Area 
                        type="natural" 
                        dataKey="spo2" 
                        stroke="#10b981" 
                        fill="none" 
                        strokeWidth={2} 
                        dot={(props) => renderSmartDot(props, 100, 94, '#10b981')} 
                        activeDot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "#10b981" }}
                        name="SpO2" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  
                  <AnimatePresence>
                    {trendPopup && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-gray-100 z-50 pointer-events-none min-w-[120px]"
                        style={{ left: trendPopup.x - 60, top: trendPopup.y - 80 }}
                      >
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">{trendPopup.name}</p>
                        <p className="text-xl font-black text-gray-900 tabular-nums leading-none">
                          {trendPopup.value}
                        </p>
                        <p className="text-[10px] text-emerald-500 font-bold mt-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 
                          {trendPopup.value > 120 || trendPopup.value < 60 ? "Abnormal" : "Healthy Pattern"}
                        </p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                    <Activity className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-800 font-bold mb-1">No trends available yet</p>
                  <p className="text-[11px] text-gray-500 font-medium tracking-wide max-w-[200px]">Start logging vitals to see patterns.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Alert preview */}
        <div className="card p-6 card-hover flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Active Alerts</h2>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {dashboardData.activeAlerts.length > 0
                    ? `${dashboardData.activeAlerts.length} signal${dashboardData.activeAlerts.length > 1 ? "s" : ""} need attention`
                    : "All systems stable"}
                </p>
                {dashboardData.activeAlerts.some((a: any) => a.severity === "immediate" || a.severity === "critical") && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
            </div>
            <Link href="/alerts" className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors no-underline">
              View all {"->"}
            </Link>
          </div>

          <div className="flex-1 space-y-2">
            {dashboardData.activeAlerts.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {dashboardData.activeAlerts.slice(0, 3).map((a: any, i: number) => {
                  const isCritical = a.severity === "immediate" || a.severity === "critical";
                  const dotColor = isCritical ? "bg-red-500" :
                    (a.severity === "high" || a.severity === "warning") ? "bg-amber-400" : "bg-blue-400";
                  const cardBg = isCritical ? "bg-red-50/70 border-red-200" :
                    (a.severity === "high" || a.severity === "warning") ? "bg-amber-50/60 border-amber-200" :
                    "bg-blue-50/40 border-blue-100";
                  const badgeStyle = isCritical ? "bg-red-600 text-white" :
                    (a.severity === "high" || a.severity === "warning") ? "bg-amber-500 text-white" :
                    "bg-blue-500 text-white";

                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className={`relative flex items-start gap-3 p-3 rounded-xl border ${cardBg} ${isCritical ? "ring-1 ring-red-200/60" : ""}`}
                    >
                      {isCritical && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 rounded-l-xl animate-pulse" />}
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dotColor} ${isCritical ? "animate-pulse" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${badgeStyle}`}>
                            {isCritical ? "Critical" : (a.severity === "high" || a.severity === "warning") ? "Warning" : "Monitor"}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold">{a.time}</span>
                        </div>
                        <p className="text-[11px] font-bold text-gray-900 truncate">{a.title}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{a.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-gray-800 mb-0.5">All systems stable</p>
                <p className="text-[10px] text-gray-400 font-medium">No active alerts right now</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick summary + Activity feed + Secondary metrics */}
      <div className="grid grid-cols-3 gap-4">

        {/* Quick Summary */}
        <motion.div
          layout
          onClick={() => setIsProfileExpanded(e => !e)}
          className="card p-6 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-200 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Quick Summary</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                {dashboardData.activeAlerts.length > 0 ? "Alerts Active" : "Monitoring Active"}
              </span>
            </div>
          </div>

          {dashboardData.profile.full_name ? (
            <div className="space-y-0">
              {/* Identity block */}
              <div className="mb-4">
                <p className="text-lg font-black text-gray-900 tracking-tight">{dashboardData.profile.full_name}</p>
                {dashboardData.profile.pregnancy_week && (
                  <p className="text-sm font-bold text-gray-500 mt-0.5">
                    Week {dashboardData.profile.pregnancy_week} - {getPregnancyTrimester(dashboardData.profile.pregnancy_week)}
                  </p>
                )}
              </div>

              {/* Key stats */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Due Date</span>
                  <span className="text-xs font-bold text-gray-800">
                    {(() => {
                      if (dashboardData.profile.due_date) return format(new Date(dashboardData.profile.due_date), "dd MMM yyyy");
                      if (dashboardData.profile.pregnancy_week) return format(addWeeks(new Date(), 40 - dashboardData.profile.pregnancy_week), "dd MMM yyyy");
                      return "Not set";
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">OB Provider</span>
                  <span className="text-xs font-bold text-gray-800 truncate max-w-[120px] text-right">{dashboardData.profile.provider_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">System</span>
                  {loading ? (
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" /> Syncing
                    </span>
                  ) : dashboardData.activeAlerts.length > 0 ? (
                    <span className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Alerts
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Stable
                    </span>
                  )}
                </div>
              </div>

              {/* Expand: Stage info */}
              <AnimatePresence>
                {isProfileExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Current stage</p>
                      <p className="text-xs font-medium text-gray-700 leading-relaxed">
                        {dashboardData.profile.pregnancy_week == null
                          ? "Update your profile to see stage-specific guidance."
                          : dashboardData.profile.pregnancy_week < 13
                          ? "Your body is adjusting to pregnancy. Focus on rest, prenatal vitamins, and regular check-ups."
                          : dashboardData.profile.pregnancy_week <= 27
                          ? "Energy often returns during this phase. Stay active, track fetal movement, and attend all scans."
                          : "Baby is growing quickly. Watch for swelling, blood pressure changes, and prepare for delivery."}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-[9px] text-gray-400 font-bold text-center pt-3 uppercase tracking-widest">
                {isProfileExpanded ? "Tap to collapse" : "Tap for stage details"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                <Activity className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-xs font-bold text-gray-500 mb-1">Profile incomplete</p>
              <Link href="/profile" className="text-[10px] text-blue-600 font-black hover:underline uppercase tracking-widest">
                Complete profile {"->"}
              </Link>
            </div>
          )}
        </motion.div>

        {/* Activity feed - today only */}
        <div className="card p-6 overflow-hidden flex flex-col max-h-[520px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Activity Feed</h2>
              <p className="text-sm font-bold text-gray-900">Today</p>
            </div>
          </div>

          {/* Detail popup */}
          <AnimatePresence>
            {selectedFeedItem && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="mb-3 p-3.5 bg-gray-900 text-white rounded-2xl"
                onClick={() => setSelectedFeedItem(null)}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{selectedFeedItem.title}</p>
                <p className="text-xs font-semibold leading-relaxed">{selectedFeedItem.description}</p>
                <p className="text-[9px] text-gray-500 mt-1.5 font-bold">{selectedFeedItem.time} - tap to dismiss</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1 overflow-y-auto flex-1 pr-1">
            {(() => {
              // Only show today's items
              const todayGroup = dashboardData.activityFeed.find((g: any) => g.header === "Today");
              const todayItems: any[] = todayGroup?.items || [];

              if (todayItems.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                      <Activity className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-600 mb-0.5">No activity yet today</p>
                    <p className="text-[10px] text-gray-400 font-medium">Start logging vitals or meals to see them here</p>
                  </div>
                );
              }

              return (
                <AnimatePresence mode="popLayout">
                  {todayItems.map((item: any, i: number) => {
                    const typeColor = item.type === 'vitals' ? 'bg-blue-500' :
                      item.type === 'meal' ? 'bg-emerald-500' :
                      item.type === 'log' ? 'bg-purple-500' : 'bg-gray-400';
                    const typeBg = item.type === 'vitals' ? 'bg-blue-50 border-blue-100' :
                      item.type === 'meal' ? 'bg-emerald-50 border-emerald-100' :
                      item.type === 'log' ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100';

                    // Format a human-readable action string
                    let actionText = item.description;
                    if (item.type === 'vitals' && !item.isGrouped) {
                      // "HR: 78 bpm, BP: 120/80, SpO2: 98%" -> keep concise
                      actionText = item.description;
                    } else if (item.isGrouped) {
                      const countStr = item.type === 'vitals' ? 'vitals updated' :
                        item.type === 'meal' ? 'meals logged' : 'logs updated';
                      actionText = `${item.count || ''} ${countStr} today`;
                    }

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ delay: i * 0.04, duration: 0.2 }}
                        onClick={() => setSelectedFeedItem(selectedFeedItem?.id === item.id ? null : item)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all duration-150 ${typeBg}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${typeColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-gray-900 truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{actionText}</p>
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap flex-shrink-0">{item.time}</span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              );
            })()}
          </div>
        </div>

        {/* Daily Performance Tracker */}
        <div className="card p-6 flex flex-col h-full bg-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Daily Performance</h2>
              <p className="text-sm font-bold text-gray-900">Today's Balance</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-gray-900 tabular-nums">{dashboardData.performanceScore}%</span>
              <span className="text-[10px] font-bold text-gray-400">SCORE</span>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {dashboardData.hydration.value === 0 && dashboardData.sleep.value === 0 && dashboardData.mood.value === "Not logged" ? (
              <div className="flex flex-col items-center justify-center py-10 text-center h-full">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <Activity className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-xs font-bold text-gray-600 mb-1">Start logging to track your day</p>
                <p className="text-[10px] text-gray-400 font-medium">Daily goals help maintain a healthy pregnancy</p>
              </div>
            ) : (
              <>
                {/* Hydration Card */}
                <motion.div 
                  layout
                  onClick={() => setExpandedMetric(expandedMetric === 'water' ? null : 'water')}
                  className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 cursor-pointer hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm text-blue-500">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-blue-600/60 uppercase tracking-widest">Hydration</p>
                        <p className="text-xs font-bold text-gray-900">{dashboardData.hydration.value} / 2.5 L</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-blue-600 tabular-nums">{dashboardData.hydration.pct}%</span>
                  </div>
                  
                  <div className="h-1.5 w-full bg-blue-100/50 rounded-full overflow-hidden mb-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${dashboardData.hydration.pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${dashboardData.hydration.pct >= 100 ? 'text-emerald-600' : dashboardData.hydration.pct >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {dashboardData.hydration.pct >= 100 ? "Goal met" : dashboardData.hydration.pct >= 70 ? "Good progress" : "Needs intake"}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover:text-blue-500 transition-colors">
                      {expandedMetric === 'water' ? "Close" : "Details"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {expandedMetric === 'water' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-3 border-t border-blue-100/50 space-y-2">
                          <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                            Hydration supports amniotic fluid levels and fetal circulation. 
                            <span className="block mt-1 font-bold">Important for your current week.</span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Sleep Card */}
                <motion.div 
                  layout
                  onClick={() => setExpandedMetric(expandedMetric === 'sleep' ? null : 'sleep')}
                  className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100/50 cursor-pointer hover:bg-purple-50 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm text-purple-500">
                        <Moon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-purple-600/60 uppercase tracking-widest">Sleep</p>
                        <p className="text-xs font-bold text-gray-900">{dashboardData.sleep.value} / 8 hours</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-purple-600 tabular-nums">{dashboardData.sleep.pct}%</span>
                  </div>
                  
                  <div className="h-1.5 w-full bg-purple-100/50 rounded-full overflow-hidden mb-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${dashboardData.sleep.pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-purple-500 rounded-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${dashboardData.sleep.pct >= 90 ? 'text-emerald-600' : dashboardData.sleep.pct >= 70 ? 'text-purple-600' : 'text-amber-600'}`}>
                      {dashboardData.sleep.status}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover:text-purple-500 transition-colors">
                      {expandedMetric === 'sleep' ? "Close" : "Details"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {expandedMetric === 'sleep' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-3 border-t border-purple-100/50 space-y-2">
                          <p className="text-[10px] text-purple-700 font-medium leading-relaxed">
                            Consistent rest helps regulate blood pressure and supports baby's development.
                            <span className="block mt-1 font-bold">Important for your current week.</span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Mood Card */}
                <motion.div 
                  layout
                  onClick={() => setExpandedMetric(expandedMetric === 'mood' ? null : 'mood')}
                  className={`p-4 rounded-2xl ${moodConfig[dashboardData.mood.color].bg}/50 border ${moodConfig[dashboardData.mood.color].border}/50 cursor-pointer hover:${moodConfig[dashboardData.mood.color].bg} transition-colors group`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 bg-white rounded-lg shadow-sm ${moodConfig[dashboardData.mood.color].icon}`}>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-[10px] font-black ${moodConfig[dashboardData.mood.color].text}/60 uppercase tracking-widest`}>Mood</p>
                        <p className="text-xs font-bold text-gray-900">{dashboardData.mood.value}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black ${moodConfig[dashboardData.mood.color].text} tabular-nums`}>{dashboardData.mood.pct}%</span>
                  </div>
                  
                  <div className={`h-1.5 w-full ${moodConfig[dashboardData.mood.color].bg} rounded-full overflow-hidden mb-2`}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${dashboardData.mood.pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full bg-${dashboardData.mood.indicatorColor}-500 rounded-full`}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold text-${dashboardData.mood.indicatorColor}-600`}>
                      {dashboardData.mood.status}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover:text-emerald-500 transition-colors">
                      {expandedMetric === 'mood' ? "Close" : "Details"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {expandedMetric === 'mood' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-3 border-t border-gray-100 space-y-2">
                          <p className="text-[10px] text-gray-600 font-medium leading-relaxed">
                            Emotional well-being is directly tied to physiological stability. 
                            <span className="block mt-1 font-bold">Important for your current week.</span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Steps Card */}
                <motion.div
                  layout
                  className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm text-indigo-500">
                        <Footprints className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest">Steps</p>
                        <p className="text-xs font-bold text-gray-900 tabular-nums">{dashboardData.steps.value}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 tabular-nums">
                      {dashboardData.steps.trend === "active" ? "LIVE" : "--"}
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-indigo-100/50 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (dashboardData.steps.value / 3000) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${dashboardData.steps.trend === "active" ? "text-indigo-600" : "text-gray-500"}`}>
                      {dashboardData.steps.status}
                    </span>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
