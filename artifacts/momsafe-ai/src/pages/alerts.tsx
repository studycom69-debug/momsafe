import { useState, useEffect, useMemo, useCallback } from "react";
import { AlertCircle, BellOff, CheckCircle2, Clock, ChevronDown, X, Activity, Droplets, Moon, Pill, CheckCheck, Brain, ChevronRight, Zap, Heart, Wind, Thermometer, Info, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const tabs = ["Active", "Resolved", "Dismissed"] as const;
type Tab = typeof tabs[number];

// ── Color / style maps ────────────────────────────────────────────────────────
const SEV_BORDER: Record<string, string> = {
  immediate: "border-red-200",
  critical:  "border-red-200",
  high:      "border-orange-200",
  warning:   "border-amber-200",
  monitor:   "border-yellow-200",
  info:      "border-blue-100",
  normal:    "border-emerald-100",
};
const SEV_BG: Record<string, string> = {
  immediate: "bg-red-50/60",
  critical:  "bg-red-50/60",
  high:      "bg-orange-50/60",
  warning:   "bg-amber-50/50",
  monitor:   "bg-yellow-50/50",
  info:      "bg-blue-50/40",
  normal:    "bg-emerald-50/40",
};
const SEV_BADGE: Record<string, string> = {
  immediate: "bg-red-600 text-white",
  critical:  "bg-red-600 text-white",
  high:      "bg-orange-500 text-white",
  warning:   "bg-amber-500 text-white",
  monitor:   "bg-yellow-400 text-gray-900",
  info:      "bg-blue-500 text-white",
  normal:    "bg-emerald-500 text-white",
};
const SEV_LABEL: Record<string, string> = {
  immediate: "Critical",
  critical:  "Critical",
  high:      "High",
  warning:   "Warning",
  monitor:   "Monitor",
  info:      "Info",
  normal:    "Stable",
};
const SEV_ICON_COLOR: Record<string, string> = {
  immediate: "text-red-500",
  critical:  "text-red-500",
  high:      "text-orange-500",
  warning:   "text-amber-500",
  monitor:   "text-yellow-500",
  info:      "text-blue-500",
  normal:    "text-emerald-500",
};
const SEV_DOT: Record<string, string> = {
  immediate: "bg-red-500",
  critical:  "bg-red-500",
  high:      "bg-orange-500",
  warning:   "bg-amber-400",
  monitor:   "bg-yellow-400",
  info:      "bg-blue-400",
  normal:    "bg-emerald-400",
};

// Vital icon helper
const VITAL_ICONS: Record<string, React.ReactNode> = {
  "Heart Rate":    <Heart className="w-3 h-3" />,
  "Blood Pressure": <Activity className="w-3 h-3" />,
  "SpO2":          <Wind className="w-3 h-3" />,
  "Temperature":   <Thermometer className="w-3 h-3" />,
  "Water Intake":  <Droplets className="w-3 h-3" />,
  "Sleep":         <Moon className="w-3 h-3" />,
};

// WHY IT MATTERS map
const WHY_MAP: Record<string, string> = {
  "High Blood Pressure": "Elevated BP during pregnancy can lead to preeclampsia, which requires immediate medical attention.",
  "Low Oxygen Level": "Low SpO2 can reduce oxygen delivered to your baby, which is critical for healthy fetal development.",
  "High Temperature": "Fever during pregnancy can be a sign of infection and may affect the developing fetus.",
  "Insufficient Sleep": "Adequate sleep is essential for immune function and healthy pregnancy outcomes.",
  "Low Water Intake": "Dehydration can cause preterm contractions and reduce nutrient delivery to your baby.",
  "High Heart Rate": "A sustained elevated heart rate can be a sign of stress, dehydration, or an underlying condition.",
  "Sudden Weight Change": "Rapid weight changes may indicate fluid retention, which could signal preeclampsia.",
};

// ACTION MAP
const ACTION_MAP: Record<string, string[]> = {
  "High Blood Pressure": ["Rest for 15 minutes", "Recheck BP in 30 min", "Reduce salt intake today"],
  "Low Oxygen Level": ["Practice deep breathing", "Sit upright and relax", "Recheck oxygen level"],
  "High Temperature": ["Stay well hydrated", "Rest in a cool room", "Monitor closely for 30 min"],
  "Insufficient Sleep": ["Take a short rest now", "Avoid screens before bed", "Aim for 7–8 hours tonight"],
  "Low Water Intake": ["Drink 0.5L water now", "Set a hydration reminder", "Carry water with you"],
  "High Heart Rate": ["Rest and hydrate", "Practice deep breathing", "Monitor for dizziness"],
  "Sudden Weight Change": ["Check for swelling", "Review recent diet", "Monitor daily weight"],
  "Reported Symptom: Shortness of Breath": ["Sit upright", "Try deep breathing", "Call provider if worsening"],
  "Reported Symptom: Nausea": ["Small frequent meals", "Stay hydrated", "Rest with head elevated"],
  "Reported Symptom: Headache": ["Rest in a dark room", "Hydrate well", "Check blood pressure"],
  "Reported Symptom: Swelling": ["Elevate feet", "Reduce salt intake", "Monitor for headaches"],
};

type AlertSeverity = "immediate" | "high" | "monitor" | "critical" | "warning" | "info";
type AlertStatus   = "active" | "resolved" | "dismissed";

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  is_read: boolean;
  created_at: string;
  actions?: string[];
  count?: number;
  last_occurrence?: string;
  all_ids?: string[];
}

function formatTimeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function systemVoiceLine(alert: Alert) {
  const t = alert.title.toLowerCase();
  if (t.includes("spo2") || t.includes("oxygen")) return "Your oxygen level dropped below the safe range.";
  if (t.includes("blood pressure") || t.includes("bp")) return "Your blood pressure reading needs attention.";
  if (t.includes("temperature") || t.includes("fever")) return "Your temperature is outside the safe range.";
  if (t.includes("heart rate") || t.includes("pulse")) return "Your heart rate is higher than expected.";
  if (alert.severity === "immediate" || alert.severity === "critical") return "This needs your attention right now.";
  if (alert.severity === "high" || alert.severity === "warning") return "Please check in and take a quick action.";
  return "Not urgent, but worth a quick look.";
}

// ── Individual Alert Card ─────────────────────────────────────────────────────
function AlertCard({
  alert,
  onResolve,
  onDismiss,
  onMarkRead,
}: {
  alert: Alert;
  onResolve: (ids: string[]) => void;
  onDismiss: (ids: string[]) => void;
  onMarkRead: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [attention, setAttention] = useState(false);

  const isCritical = alert.severity === "immediate" || alert.severity === "critical";
  const isWarning  = alert.severity === "high" || alert.severity === "warning";
  const ids        = alert.all_ids || [alert.id];
  const why        = WHY_MAP[alert.title] || "This reading is outside your typical healthy range and may need attention.";
  const actions    = ACTION_MAP[alert.title] || ["Recheck in 10 minutes", "Log a new reading now"];
  const timeAgo    = formatTimeAgo(new Date(alert.last_occurrence || alert.created_at));

  useEffect(() => {
    if (!isCritical || alert.status !== "active") return;
    setAttention(true);
    const t = window.setTimeout(() => setAttention(false), 2600);
    return () => window.clearTimeout(t);
  }, [isCritical, alert.status]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.985 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`
        relative overflow-hidden rounded-2xl border cursor-pointer
        transition-all duration-200 select-none
        ${SEV_BORDER[alert.severity]} ${SEV_BG[alert.severity]}
        ${isCritical ? "border-red-300/80" : ""}
        ${isCritical ? "shadow-[0_10px_30px_-18px_rgba(239,68,68,0.45)]" : "shadow-[0_10px_28px_-22px_rgba(15,23,42,0.18)]"}
        ${attention ? "ring-2 ring-red-300/60 shadow-[0_0_0_1px_rgba(239,68,68,0.10),0_18px_46px_-22px_rgba(239,68,68,0.60)]" : ""}
        ${alert.status !== "active" ? "opacity-60" : "hover:shadow-md hover:-translate-y-px"}
      `}
    >
      {/* Left stripe hierarchy */}
      {isCritical && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-red-500 ${attention ? "animate-pulse" : ""}`} />
      )}
      {isWarning && !isCritical && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-2xl" />
      )}

      <div className="p-5 pl-6">
        {/* Row 1: Title + badge + time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Severity dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${SEV_DOT[alert.severity]} ${attention ? "animate-pulse" : ""}`} />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-black text-gray-900 tracking-tight ${isCritical ? "text-red-900" : ""}`}>
                  {alert.title}
                  {(alert.count || 0) > 1 && (
                    <span className="ml-2 text-[10px] font-bold text-gray-500 normal-case tracking-normal">
                      ({alert.count}× detected)
                    </span>
                  )}
                </h3>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0 ${SEV_BADGE[alert.severity]}`}>
                  {SEV_LABEL[alert.severity]}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5 line-clamp-1">
                {alert.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">{timeAgo}</span>
            <motion.button
              type="button"
              onClick={e => { e.stopPropagation(); setExpanded(v => !v); if (!alert.is_read) onMarkRead(ids); }}
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="p-1 rounded-lg hover:bg-white/70 transition-colors"
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </motion.button>
          </div>
        </div>

        {/* System voice line */}
        <p className={`mt-2 text-xs font-semibold leading-snug ${isCritical ? "text-red-900" : isWarning ? "text-amber-900" : "text-gray-800"}`}>
          {systemVoiceLine(alert)}
        </p>

        {/* Action buttons (always visible) */}
        {alert.status === "active" && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (!alert.is_read) onMarkRead(ids);
                setExpanded(v => !v);
              }}
              className={`px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm ${
                isCritical
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : isWarning
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-gray-900 text-white hover:bg-gray-700"
              }`}
            >
              View Details
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (!alert.is_read) onMarkRead(ids);
                onResolve(ids);
              }}
              className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-colors"
            >
              Mark as Resolved
            </button>
          </div>
        )}

        {/* Expanded section */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4 border-t border-gray-100/80 pt-4">
                {/* Short explanation */}
                <div className="p-3.5 bg-white/70 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Explanation</p>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed line-clamp-3">{why}</p>
                </div>

                {/* Simple suggestion */}
                <div className="p-3.5 bg-white/70 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Suggestion</p>
                  <p className="text-xs text-gray-800 font-semibold leading-relaxed">
                    {actions[0] || "Recheck in 10 minutes."}
                  </p>
                </div>

                {alert.status !== "active" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {alert.status}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Alerts() {
  const { user } = useAuth();
  const [rawAlerts, setRawRecords] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Active");

  // ── Backend (unchanged) ──
  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRawRecords(data || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel("alerts-realtime-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `user_id=eq.${user?.id}` }, () => fetchAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts, user?.id]);

  const updateAlertStatus = async (ids: string[], status: AlertStatus) => {
    try {
      setRawRecords(prev => prev.map(a => ids.includes(a.id) ? { ...a, status, is_read: true } : a));
      const { error } = await supabase.from("alerts").update({ status, is_read: true }).in("id", ids);
      if (error) { console.error("Error updating alert status:", error); fetchAlerts(); }
      else { toast.success(`${ids.length} alert${ids.length > 1 ? "s" : ""} marked as ${status}`); }
    } catch (error) { console.error("Error updating alert status:", error); }
  };

  const markAsRead = async (ids: string[]) => {
    try {
      setRawRecords(prev => prev.map(a => ids.includes(a.id) ? { ...a, is_read: true } : a));
      const { error } = await supabase.from("alerts").update({ is_read: true }).in("id", ids);
      if (error) { console.error("Error marking as read:", error); fetchAlerts(); }
    } catch (error) { console.error("Error marking as read:", error); }
  };

  // ── Processing (unchanged logic) ──
  const processedAlerts = useMemo(() => {
    const grouped: Record<string, Alert> = {};
    rawAlerts.forEach(alert => {
      const normalizedStatus = alert.status || "active";
      const key = `${alert.title}-${normalizedStatus}`;
      if (!grouped[key]) {
        grouped[key] = { ...alert, status: normalizedStatus, count: 1, last_occurrence: alert.created_at, all_ids: [alert.id] };
      } else {
        grouped[key].count = (grouped[key].count || 0) + 1;
        grouped[key].all_ids?.push(alert.id);
        if (new Date(alert.created_at) > new Date(grouped[key].last_occurrence!)) {
          grouped[key].last_occurrence = alert.created_at;
        }
      }
    });

    const list = Object.values(grouped).map(alert => ({
      ...alert,
      actions: ACTION_MAP[alert.title] || ["Recheck in 10 minutes", "Log new reading now"],
    }));

    const filtered = list.filter(a => {
      if (activeTab === "Active") return (a.status || "active") === "active" && !a.is_read;
      if (activeTab === "Resolved") return a.status === "resolved";
      if (activeTab === "Dismissed") return a.status === "dismissed";
      return true;
    });

    const severityMap: Record<string, number> = { immediate: 0, critical: 0, high: 1, warning: 1, monitor: 2, info: 3 };
    return filtered.sort((a, b) => {
      const sevA = severityMap[a.severity] ?? 4;
      const sevB = severityMap[b.severity] ?? 4;
      if (sevA !== sevB) return sevA - sevB;
      return new Date(b.last_occurrence || b.created_at).getTime() - new Date(a.last_occurrence || a.created_at).getTime();
    });
  }, [rawAlerts, activeTab]);

  const alertSummary = useMemo(() => {
    const active = processedAlerts;
    const hasImmediate = active.some(a => a.severity === "immediate" || a.severity === "critical");
    const hasHigh = active.some(a => a.severity === "high" || a.severity === "warning");
    const hasMonitor = active.some(a => a.severity === "monitor" || a.severity === "info");
    if (hasImmediate) return { text: "Critical health signals detected. Immediate attention required.", color: "red" };
    if (hasHigh) return { text: "Elevated readings detected. Monitor closely and follow guidance.", color: "amber" };
    if (hasMonitor) return { text: "Some parameters need observation. Continue tracking regularly.", color: "blue" };
    return { text: "All systems stable. Your health parameters are within normal range.", color: "emerald" };
  }, [processedAlerts]);

  const activeCount = rawAlerts.filter(a => (a.status || "active") === "active" && !a.is_read).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Alert Center</h1>
          <p className="page-subtitle">Prioritized health signals and actionable guidance.</p>
        </div>
        <div className="flex p-1 bg-gray-50 border border-gray-100 rounded-2xl gap-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
              {tab === "Active" && activeCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Smart Summary Banner */}
      {activeTab === "Active" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-2xl border flex items-start gap-3 ${
            alertSummary.color === "red"     ? "bg-red-50/60 border-red-200" :
            alertSummary.color === "amber"   ? "bg-amber-50/60 border-amber-200" :
            alertSummary.color === "blue"    ? "bg-blue-50/50 border-blue-100" :
            "bg-emerald-50/50 border-emerald-100"
          }`}
        >
          <div className={`p-2 rounded-xl flex-shrink-0 ${
            alertSummary.color === "red"     ? "bg-red-100 text-red-600" :
            alertSummary.color === "amber"   ? "bg-amber-100 text-amber-600" :
            alertSummary.color === "blue"    ? "bg-blue-100 text-blue-600" :
            "bg-emerald-100 text-emerald-600"
          }`}>
            {alertSummary.color === "emerald" ? <ShieldCheck className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Health Signal Summary</p>
            <p className="text-sm font-semibold text-gray-800 leading-relaxed">{alertSummary.text}</p>
          </div>
        </motion.div>
      )}

      {/* Alert List */}
      <div className="space-y-3">
        {loading && rawAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Loading signals...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {processedAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={ids => updateAlertStatus(ids, "resolved")}
                onDismiss={ids => updateAlertStatus(ids, "dismissed")}
                onMarkRead={markAsRead}
              />
            ))}

            {processedAlerts.length === 0 && (
              <motion.div
                key="alerts-empty-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-base font-black text-gray-900 tracking-tight mb-1">
                  {activeTab === "Active" ? "All systems stable" : `No ${activeTab.toLowerCase()} alerts`}
                </h3>
                <p className="text-xs text-gray-400 font-medium max-w-xs">
                  {activeTab === "Active"
                    ? "Your health markers are within normal ranges. We'll notify you instantly of any changes."
                    : `No alerts have been ${activeTab.toLowerCase()} yet.`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
