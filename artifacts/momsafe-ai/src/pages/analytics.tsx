import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Activity,
  Droplets,
  Moon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Heart,
  Wind,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  X,
  CheckCircle2,
  Clock,
  Calendar,
  Info,
} from "lucide-react";
import { trendData, analyticsData, riskScore } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
import {
  calculateRiskScore as calculateEngineRiskScore,
  RiskHealthData,
} from "@/lib/ai/riskEngine";

const periods = ["24H", "7D", "30D"] as const;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-4 border border-gray-100 shadow-2xl rounded-2xl space-y-3 min-w-[220px] animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center border-b border-gray-50 pb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {label}
          </p>
          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
            Vital Analysis
          </span>
        </div>

        <div className="space-y-3">
          {payload.map((p: any, idx: number) => {
            const val = p.value;
            const name = p.name;
            const color = p.color;
            let status = "Normal";
            let statusColor = "text-emerald-500";
            let insight = "";

            if (name === "Heart Rate") {
              if (val > 100) {
                status = "Critical";
                statusColor = "text-red-500";
                insight = "Elevated rate detected.";
              } else if (val > 90) {
                status = "Warning";
                statusColor = "text-amber-500";
                insight = "Slightly elevated.";
              }
            } else if (name === "Blood Pressure") {
              const systolic =
                typeof val === "string" ? parseInt(val.split("/")[0]) : val;
              if (systolic >= 140) {
                status = "High";
                statusColor = "text-red-500";
                insight = "High BP detected.";
              } else if (systolic >= 120) {
                status = "Elevated";
                statusColor = "text-amber-500";
                insight = "Slightly elevated.";
              }
            } else if (name === "SpO2") {
              if (val < 95) {
                status = "Critical";
                statusColor = "text-red-500";
                insight = "Oxygen drop detected.";
              }
            } else if (name === "Temperature") {
              if (val > 37.5) {
                status = "Warning";
                statusColor = "text-amber-500";
                insight = "Mild fever detected.";
              }
            }

            return (
              <div key={idx} className="space-y-1 group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-bold text-gray-600">
                      {name}
                    </span>
                  </div>
                  <span className="text-sm font-black text-gray-900">
                    {val}
                    {name === "SpO2" ? "%" : name === "Temperature" ? "°C" : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3.5">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-tight ${statusColor}`}
                  >
                    {status}
                  </span>
                  {insight && (
                    <span className="text-[9px] text-gray-400 font-medium italic">
                      {insight}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const renderAbnormalDot = (
  props: any,
  type: "hr" | "systolic" | "spo2" | "temp",
) => {
  const { cx, cy, value, index } = props;
  if (value === null || value === undefined) return <></>;

  let isCritical = false;
  let isWarning = false;
  let label = "";

  switch (type) {
    case "hr":
      if (value > 100) {
        isCritical = true;
        label = "HR spike";
      }
      break;
    case "systolic":
      const systolicVal =
        typeof value === "string" ? parseInt(value.split("/")[0]) : value;
      if (systolicVal >= 160) {
        isCritical = true;
        label = "BP critical";
      } else if (systolicVal >= 140) {
        isCritical = true;
        label = "BP high";
      } else if (systolicVal >= 120) {
        isWarning = true;
        label = "BP elevated";
      }
      break;
    case "spo2":
      if (value < 95) {
        isWarning = true;
        label = "Oxygen drop";
      }
      break;
    case "temp":
      if (value > 37.5) {
        isWarning = true;
        label = "Temp rise";
      }
      break;
  }

  if (isCritical || isWarning) {
    return (
      <circle
        key={`marker-${type}-${index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill={isCritical ? "#ef4444" : "#f59e0b"}
        stroke="white"
        strokeWidth={2}
        className="animate-pulse"
      />
    );
  }

  // Standard dot for non-anomalous points
  const standardColors = {
    hr: "#3b82f6",
    systolic: "#8b5cf6",
    spo2: "#10b981",
    temp: "#f59e0b",
  };
  return (
    <circle
      key={`dot-${type}-${index}`}
      cx={cx}
      cy={cy}
      r={3}
      fill={standardColors[type]}
      stroke="white"
      strokeWidth={1}
    />
  );
};

export default function Analytics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"24H" | "7D" | "30D">("7D");
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [riskTrajectoryData, setRiskTrajectoryData] = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiStructuredResponse, setAiStructuredResponse] = useState<{
    summary: string;
    concern: string;
    action: string;
    confidence: number;
    severity: "low" | "medium" | "high";
  } | null>(null);
  const [aiRiskData, setAiRiskData] = useState<{
    outlook: string;
    reason: string;
    prevention: string;
    predictedEvents?: {
      time: string;
      event: string;
      probability: number;
      impact: "high" | "medium" | "low";
    }[];
    impactFactors?: {
      factor: string;
      weight: number;
      status: "improving" | "worsening" | "stable";
    }[];
    confidence?: number;
  } | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiMainFactor, setAiMainFactor] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiAnomalies, setAiAnomalies] = useState<any[]>([]);
  const [detectedAnomalies, setDetectedAnomalies] = useState<any[]>([]);
  const [enhancedInsights, setEnhancedInsights] = useState<any[]>([]);
  const [loadingEnhancedInsights, setLoadingEnhancedInsights] = useState(false);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [loadingRiskPrediction, setLoadingRiskPrediction] = useState(false);
  const [loadingRiskData, setLoadingRiskData] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isRiskExpanded, setIsRiskExpanded] = useState(false);
  const [isRiskTrustExpanded, setIsRiskTrustExpanded] = useState(false);
  const [isNutritionExpanded, setIsNutritionExpanded] = useState(false);
  const [isActionSectionExpanded, setIsActionSectionExpanded] = useState(false);
  const [isFullActionPlanOpen, setIsFullActionPlanOpen] = useState(false);
  const [riskPredictionGraphData, setRiskPredictionGraphData] = useState<any[]>(
    [],
  );
  const [riskActionFeedback, setRiskActionFeedback] = useState<string | null>(
    null,
  );
  const [riskThinkingMessage, setRiskThinkingMessage] = useState("");
  const [aiThinkingMessage, setAiThinkingMessage] = useState("");

  // NEW API STATES
  const [summaryData, setSummaryData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [anomalyData, setAnomalyData] = useState<any>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingAnomaly, setLoadingAnomaly] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [focusedMetric, setFocusMetric] = useState<string | null>(null);
  const [metricMetadata, setMetricMetadata] = useState<
    Record<
      string,
      {
        trend: "up" | "down" | "stable";
        trendValue: string;
        context: string;
        explanation: string;
        readings: number;
        updatedAt: string;
      }
    >
  >({});
  const [healthContext, setHealthContext] = useState({
    trend: "stable" as "increasing" | "decreasing" | "stable",
    diff: 0,
    pct: 0,
    isHighBP: false,
    isHighHR: false,
    isLowOxygen: false,
    isHighTemp: false,
    isLowSleep: false,
    isLowHydration: false,
  });
  const [healthSummary, setHealthSummary] = useState({
    summary: "Analyzing your health data...",
    status: "Stable",
    mainCause: "None",
    recommendation: "Continue monitoring",
    severity: "low" as "low" | "medium" | "high",
  });

  const [visibleVitals, setVisibleVitals] = useState({
    hr: true,
    bp: true,
    spo2: true,
    temp: true,
  });
  const [hoveredVital, setHoveredVital] = useState<string | null>(null);
  const [showActual, setShowActual] = useState(true);
  const [showPredicted, setShowPredicted] = useState(true);
  const [selectedCorrelation, setSelectedCorrelation] = useState<string | null>(
    null,
  );
  const [expandedCorrelation, setExpandedCorrelation] = useState<string | null>(
    null,
  );
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [latestLogs, setLatestLogs] = useState({
    water: 0,
    sleep: 0,
    mood: "Neutral",
  });
  const [summaryMetrics, setSummaryMetrics] = useState({
    riskScore: 0,
    criticalEvents: 0,
    avgHeartRate: 0,
    anomaliesCount: 0,
  });

  const calculateRiskScore = (vitals: any, logs: any) => {
    let score = 0;

    // Heart Rate
    if (vitals.heart_rate > 110) score += 30;
    else if (vitals.heart_rate > 95) score += 20;

    // Blood Pressure (using systolic)
    if (vitals.systolic > 140) score += 30;
    else if (vitals.systolic > 120) score += 20;

    // Sleep
    if (logs.sleep < 5) score += 25;
    else if (logs.sleep < 6) score += 15;

    // Water
    if (logs.water < 1.0) score += 20;
    else if (logs.water < 1.5) score += 10;

    // SpO2
    if (vitals.spo2 < 94) score += 25;

    return Math.min(score, 100);
  };

  const riskTrendInsight = useMemo(() => {
    const { arrow, color, hint, label } = (() => {
      if (healthContext.trend === "stable")
        return {
          arrow: "→",
          color: "text-amber-500",
          hint: "No major changes",
          label: "Risk stable over this period",
        };
      if (healthContext.trend === "increasing")
        return {
          arrow: "↑",
          color: "text-red-500",
          hint: "Monitor closely",
          label: `Risk increased by ${healthContext.pct}% over this period`,
        };
      return {
        arrow: "↓",
        color: "text-emerald-600",
        hint: "Improving trend",
        label: `Risk decreased by ${Math.abs(healthContext.pct)}% over this period`,
      };
    })();

    return {
      label,
      icon:
        healthContext.trend === "increasing"
          ? ArrowUpRight
          : healthContext.trend === "decreasing"
            ? ArrowDownRight
            : Minus,
      color,
      hint,
      arrow,
    };
  }, [healthContext]);

  const sortedCorrelations = useMemo(() => {
    const latestVitals =
      chartData.length > 0
        ? chartData[chartData.length - 1]
        : { hr: 0, systolic: 0, diastolic: 0, spo2: 100 };

    const hr = Number(latestVitals.hr ?? 0);
    const spo2 = Number(latestVitals.spo2 ?? 100);
    const systolic = Number(latestVitals.systolic ?? 0);
    const diastolic = Number(latestVitals.diastolic ?? 0);
    const sleepHours = Number(latestLogs.sleep ?? 0);
    const waterLiters = Number(latestLogs.water ?? 0);

    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

    // Deviation: 0 (normal) → 1 (high deviation). Small floor keeps the panel meaningful even on stable days.
    const baseline = 0.08;

    const devHr = (() => {
      if (!Number.isFinite(hr) || hr <= 0) return baseline;
      if (hr <= 90) return baseline;
      if (hr <= 100) return Math.max(baseline, 0.25 + ((hr - 90) / 10) * 0.25); // 90–100 → ~0.25–0.50
      return Math.max(baseline, 0.6 + clamp01((hr - 100) / 25) * 0.4); // 100–125 → 0.6–1.0
    })();

    const devSpO2 = (() => {
      if (!Number.isFinite(spo2)) return baseline;
      if (spo2 >= 97) return baseline;
      if (spo2 >= 95)
        return Math.max(baseline, 0.35 + ((97 - spo2) / 2) * 0.25); // 95–97 → ~0.35–0.60
      return Math.max(baseline, 0.65 + clamp01((95 - spo2) / 5) * 0.35); // 90–95 → 0.65–1.0
    })();

    const devSleep = (() => {
      if (!Number.isFinite(sleepHours) || sleepHours <= 0) return baseline;
      if (sleepHours >= 7) return baseline;
      if (sleepHours >= 6)
        return Math.max(baseline, 0.45 + ((7 - sleepHours) / 1) * 0.25); // 6–7 → 0.45–0.70
      return Math.max(baseline, 0.75 + clamp01((6 - sleepHours) / 2) * 0.25); // 4–6 → 0.75–1.0
    })();

    const devHydration = (() => {
      if (!Number.isFinite(waterLiters) || waterLiters < 0) return baseline;
      if (waterLiters >= 2.0) return baseline;
      if (waterLiters >= 1.5)
        return Math.max(baseline, 0.35 + ((2.0 - waterLiters) / 0.5) * 0.25); // 1.5–2.0 → 0.35–0.60
      // "low hydration → medium" but can still matter a lot if very low
      return Math.max(
        baseline,
        0.55 + clamp01((1.5 - waterLiters) / 1.0) * 0.35,
      ); // 0.5–1.5 → 0.55–0.90
    })();

    const devBp = (() => {
      if (
        !Number.isFinite(systolic) ||
        !Number.isFinite(diastolic) ||
        systolic <= 0 ||
        diastolic <= 0
      )
        return baseline;
      const isHigh = systolic >= 140 || diastolic >= 90;
      const isElevated = systolic >= 120 || diastolic >= 80;
      if (!isElevated) return baseline;
      if (!isHigh)
        return Math.max(baseline, 0.45 + clamp01((systolic - 120) / 20) * 0.15); // ~0.45–0.60
      // Medium/high: scale toward 1 as systolic approaches 160 or diastolic 100
      const s = clamp01((systolic - 140) / 20);
      const d = clamp01((diastolic - 90) / 10);
      return Math.max(baseline, 0.7 + Math.max(s, d) * 0.3);
    })();

    const weights = {
      SpO2: 0.3,
      "Heart Rate": 0.25,
      Sleep: 0.2,
      Hydration: 0.15,
      "Blood Pressure": 0.1,
    } as const;

    const impacts = [
      { factor: "SpO2", deviation: devSpO2, weight: weights["SpO2"] },
      { factor: "Heart Rate", deviation: devHr, weight: weights["Heart Rate"] },
      { factor: "Sleep", deviation: devSleep, weight: weights["Sleep"] },
      {
        factor: "Hydration",
        deviation: devHydration,
        weight: weights["Hydration"],
      },
      {
        factor: "Blood Pressure",
        deviation: devBp,
        weight: weights["Blood Pressure"],
      },
    ].map((f) => ({ ...f, impact: f.deviation * f.weight }));

    // Trend: compare recent window vs previous window (proxy for "last 24h" when period !== 24H).
    const windowSize = (() => {
      if (period === "24H") return Math.min(chartData.length, 8);
      return Math.min(chartData.length, 6);
    })();

    const lastWindow = windowSize > 0 ? chartData.slice(-windowSize) : [];
    const prevWindow =
      windowSize > 0 ? chartData.slice(-(windowSize * 2), -windowSize) : [];

    const factorSeries = (
      factor: "SpO2" | "Heart Rate" | "Sleep" | "Hydration" | "Blood Pressure",
    ) => {
      if (factor === "Sleep") return [{ value: sleepHours }];
      if (factor === "Hydration") return [{ value: waterLiters }];
      if (factor === "SpO2")
        return lastWindow.map((d) => ({ value: Number(d.spo2 ?? 100) }));
      if (factor === "Heart Rate")
        return lastWindow.map((d) => ({ value: Number(d.hr ?? 0) }));
      // Blood Pressure: use systolic/diastolic from chartData if present
      return lastWindow.map((d) => ({
        value: [Number(d.systolic ?? 0), Number(d.diastolic ?? 0)] as const,
      }));
    };

    const factorSeriesPrev = (
      factor: "SpO2" | "Heart Rate" | "Sleep" | "Hydration" | "Blood Pressure",
    ) => {
      if (factor === "Sleep") return [{ value: sleepHours }];
      if (factor === "Hydration") return [{ value: waterLiters }];
      if (factor === "SpO2")
        return prevWindow.map((d) => ({ value: Number(d.spo2 ?? 100) }));
      if (factor === "Heart Rate")
        return prevWindow.map((d) => ({ value: Number(d.hr ?? 0) }));
      return prevWindow.map((d) => ({
        value: [Number(d.systolic ?? 0), Number(d.diastolic ?? 0)] as const,
      }));
    };

    const deviationFor = (
      factor: "SpO2" | "Heart Rate" | "Sleep" | "Hydration" | "Blood Pressure",
      entry: any,
    ) => {
      if (factor === "SpO2") {
        const v = Number(entry.value);
        if (!Number.isFinite(v)) return baseline;
        if (v >= 97) return baseline;
        if (v >= 95) return Math.max(baseline, 0.35 + ((97 - v) / 2) * 0.25);
        return Math.max(baseline, 0.65 + clamp01((95 - v) / 5) * 0.35);
      }
      if (factor === "Heart Rate") {
        const v = Number(entry.value);
        if (!Number.isFinite(v) || v <= 0) return baseline;
        if (v <= 90) return baseline;
        if (v <= 100) return Math.max(baseline, 0.25 + ((v - 90) / 10) * 0.25);
        return Math.max(baseline, 0.6 + clamp01((v - 100) / 25) * 0.4);
      }
      if (factor === "Sleep") return devSleep;
      if (factor === "Hydration") return devHydration;
      // Blood Pressure
      const [sys, dia] = Array.isArray(entry.value)
        ? entry.value
        : [systolic, diastolic];
      if (
        !Number.isFinite(sys) ||
        !Number.isFinite(dia) ||
        sys <= 0 ||
        dia <= 0
      )
        return baseline;
      const isHigh = sys >= 140 || dia >= 90;
      const isElevated = sys >= 120 || dia >= 80;
      if (!isElevated) return baseline;
      if (!isHigh)
        return Math.max(baseline, 0.45 + clamp01((sys - 120) / 20) * 0.15);
      const s = clamp01((sys - 140) / 20);
      const d = clamp01((dia - 90) / 10);
      return Math.max(baseline, 0.7 + Math.max(s, d) * 0.3);
    };

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
    const trendFor = (
      factor: "SpO2" | "Heart Rate" | "Sleep" | "Hydration" | "Blood Pressure",
    ) => {
      if (lastWindow.length < 2 || prevWindow.length < 2)
        return { trend: "stable" as const, label: "Stable" };
      const lastAvg = avg(
        factorSeries(factor).map((e) => deviationFor(factor, e)),
      );
      const prevAvg = avg(
        factorSeriesPrev(factor).map((e) => deviationFor(factor, e)),
      );
      const delta = lastAvg - prevAvg;
      if (Math.abs(delta) < 0.05)
        return { trend: "stable" as const, label: "Stable" };
      if (delta > 0) return { trend: "up" as const, label: "Increasing" };
      return { trend: "down" as const, label: "Decreasing" };
    };

    const countBreaches = (
      factor: "SpO2" | "Heart Rate" | "Blood Pressure",
    ) => {
      if (lastWindow.length === 0) return { breaches: 0, total: 0 };
      if (factor === "SpO2") {
        const vals = lastWindow
          .map((d) => Number(d.spo2 ?? 100))
          .filter((v) => Number.isFinite(v));
        return {
          breaches: vals.filter((v) => v < 95).length,
          total: vals.length,
        };
      }
      if (factor === "Heart Rate") {
        const vals = lastWindow
          .map((d) => Number(d.hr ?? 0))
          .filter((v) => Number.isFinite(v) && v > 0);
        return {
          breaches: vals.filter((v) => v > 100).length,
          total: vals.length,
        };
      }
      const sysVals = lastWindow
        .map((d) => Number(d.systolic ?? 0))
        .filter((v) => Number.isFinite(v) && v > 0);
      const diaVals = lastWindow
        .map((d) => Number(d.diastolic ?? 0))
        .filter((v) => Number.isFinite(v) && v > 0);
      const total = Math.min(sysVals.length, diaVals.length);
      const breaches = Array.from({ length: total }, (_, i) =>
        sysVals[i] >= 120 || diaVals[i] >= 80 ? 1 : 0,
      ).reduce((s, n) => s + n, 0);
      return { breaches, total };
    };

    const impactSum = impacts.reduce((s, f) => s + f.impact, 0) || 1;
    const toPct = (impact: number) => (impact / impactSum) * 100;

    const roleLabel = (pct: number) => {
      if (pct > 40) return "Primary Driver";
      if (pct >= 20) return "Contributing Factor";
      return "Minor Impact";
    };

    const impactLevel = (pct: number) => {
      if (pct > 40) return "High";
      if (pct >= 20) return "Medium";
      return "Low";
    };

    const factorStatusLabel = (factor: string) => {
      if (factor === "SpO2") return spo2 < 95 ? "Low SpO2" : "SpO2";
      if (factor === "Heart Rate")
        return hr > 100 ? "Elevated heart rate" : "Heart rate";
      if (factor === "Sleep") return sleepHours < 7 ? "Short sleep" : "Sleep";
      if (factor === "Hydration")
        return waterLiters < 2.0 ? "Low hydration" : "Hydration";
      if (factor === "Blood Pressure")
        return systolic >= 120 || diastolic >= 80
          ? "Abnormal blood pressure"
          : "Blood pressure";
      return factor;
    };

    const getIndicator = (pct: number) => {
      if (pct > 40)
        return {
          color: "text-red-500",
          bg: "bg-red-400",
          arrow: "↑",
          label: "High Impact",
        };
      if (pct >= 20)
        return {
          color: "text-amber-500",
          bg: "bg-amber-400",
          arrow: "→",
          label: "Moderate Impact",
        };
      return {
        color: "text-emerald-600",
        bg: "bg-emerald-400",
        arrow: "↓",
        label: "Lower Impact",
      };
    };

    const sorted = impacts
      .map((f) => {
        const pct = toPct(f.impact);
        const tr = trendFor(f.factor as any);
        const breaches =
          f.factor === "SpO2" ||
          f.factor === "Heart Rate" ||
          f.factor === "Blood Pressure"
            ? countBreaches(f.factor as any)
            : { breaches: 0, total: 0 };

        const personalizedExplanation = (() => {
          if (f.factor === "SpO2") {
            if (breaches.total > 0 && breaches.breaches > 0) {
              return `SpO2 dipped below the normal range (${breaches.breaches}/${breaches.total} recent readings under 95%), increasing risk contribution.`;
            }
            return `Your recent SpO2 readings are mostly within range, so oxygen is a smaller contributor right now.`;
          }
          if (f.factor === "Heart Rate") {
            if (breaches.total > 0 && breaches.breaches > 0) {
              return `Heart rate exceeded 100 bpm in ${breaches.breaches}/${breaches.total} recent readings, which can increase cardiovascular load and raise overall risk contribution.`;
            }
            return `Recent heart rate readings are generally within range, making it a lower contributor at the moment.`;
          }
          if (f.factor === "Blood Pressure") {
            if (breaches.total > 0 && breaches.breaches > 0) {
              return `Blood pressure was above the normal range in ${breaches.breaches}/${breaches.total} recent readings (≥120 systolic or ≥80 diastolic), contributing to systemic strain.`;
            }
            return `Recent blood pressure readings are mostly within range, so it contributes less to your current risk.`;
          }
          if (f.factor === "Sleep") {
            if (sleepHours < 7) {
              return `Sleep was ${sleepHours.toFixed(1)}h recently, below the 6–7h target range, which can reduce recovery and amplify other risk signals.`;
            }
            return `Sleep is around ${sleepHours.toFixed(1)}h, supporting recovery and reducing its contribution to risk.`;
          }
          // Hydration
          if (waterLiters < 2.0) {
            return `Hydration is about ${waterLiters.toFixed(1)}L today, below your typical goal range, which may increase fatigue and cardiovascular strain.`;
          }
          return `Hydration is about ${waterLiters.toFixed(1)}L today, helping stabilize circulation and reducing risk contribution.`;
        })();

        return {
          factor: f.factor,
          percent: pct,
          role: roleLabel(pct),
          impactLevel: impactLevel(pct),
          trend: tr.trend,
          trendLabel: tr.label,
          indicator: getIndicator(pct),
          explanation: personalizedExplanation,
          summaryLabel: factorStatusLabel(f.factor),
          deviation: f.deviation,
        };
      })
      .sort((a, b) => b.percent - a.percent);

    const primary = sorted[0];
    const secondary = sorted[1];
    const summaryLine =
      primary && secondary
        ? `${primary.summaryLabel} and ${secondary.summaryLabel} are the main contributors to your current risk`
        : primary
          ? `${primary.summaryLabel} is the main contributor to your current risk`
          : "Your current risk is distributed across multiple factors";

    const focusText = (factor: string) => {
      if (factor === "SpO2") return "Improve oxygen levels";
      if (factor === "Heart Rate") return "Monitor heart rate";
      if (factor === "Sleep") return "Prioritize sleep";
      if (factor === "Hydration") return "Increase hydration";
      return "Monitor blood pressure";
    };

    const focusLine = (() => {
      const a = sorted[0];
      const b = sorted[1];
      if (a && b)
        return `Primary focus: ${focusText(a.factor)} and ${focusText(b.factor)}`;
      if (a) return `Primary focus: ${focusText(a.factor)}`;
      return "Primary focus: Continue monitoring";
    })();

    return { items: sorted, summaryLine, focusLine };
  }, [chartData, latestLogs, period]);

  const generateInsights = (vitals: any, logs: any) => {
    let insights = [];

    // Hydration
    if (logs.water < 1.5) {
      insights.push({
        type: "hydration",
        title: "Hydration levels are low",
        cause: "Water intake is below recommended level",
        action: "Drink at least 500ml water in the next hour",
        severity: "medium",
      });
    }

    // Sleep
    if (logs.sleep < 6) {
      insights.push({
        type: "sleep",
        title: "Sleep duration is insufficient",
        cause: "Recent sleep hours are below optimal",
        action: "Try to get 7–8 hours of rest tonight",
        severity: "high",
      });
    }

    // Heart Rate
    if (vitals.heart_rate > 100) {
      insights.push({
        type: "heart",
        title: "Heart rate is elevated",
        cause: "Could be due to stress or low recovery",
        action: "Take a short rest and avoid exertion",
        severity: "medium",
      });
    }

    // SpO2
    if (vitals.spo2 < 95) {
      insights.push({
        type: "oxygen",
        title: "Oxygen level is slightly low",
        cause: "May affect breathing efficiency",
        action: "Sit calmly and focus on slow breathing",
        severity: "high",
      });
    }

    // Temperature
    if (vitals.temp > 37.5) {
      insights.push({
        type: "temperature",
        title: "Body temperature is elevated",
        cause: "Possible early fever",
        action: "Rest and stay hydrated",
        severity: "medium",
      });
    }

    if (insights.length === 0) {
      return [
        {
          title: "Everything looks stable",
          cause: "All vitals are within normal range",
          action: "Keep maintaining your healthy routine",
          severity: "low",
        },
      ];
    }

    return insights;
  };

  const structuredInsights = useMemo(() => {
    const latestVitals =
      chartData.length > 0
        ? chartData[chartData.length - 1]
        : { heart_rate: 0, spo2: 100, temp: 36.6 };
    // Map chartData keys to what generateInsights expects
    const vitalsForInsights = {
      heart_rate: latestVitals.hr,
      spo2: latestVitals.spo2,
      temp: latestVitals.temp || latestVitals.temperature,
    };

    return generateInsights(vitalsForInsights, latestLogs);
  }, [chartData, latestLogs]);

  const anomalyUi = useMemo(() => {
    const anomalies = Array.isArray(aiAnomalies) ? aiAnomalies : [];

    const getType = (a: any) =>
      (a?.type || a?.vital || a?.name || "Anomaly").toString();
    const normalizeTypeKey = (t: string) => t.trim().toLowerCase();

    const getSeverity = (a: any) => {
      const s = (a?.level || a?.severity || "low").toString().toLowerCase();
      if (s.includes("high")) return "high";
      if (s.includes("moderate") || s.includes("medium")) return "moderate";
      return "low";
    };

    const getTimestamp = (a: any) =>
      a?.timestamp ||
      a?.time ||
      a?.date ||
      a?.recorded_at ||
      a?.created_at ||
      null;

    const asDate = (t: any) => {
      if (!t) return null;
      const d = t instanceof Date ? t : new Date(t);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const getValue = (a: any) => {
      const v = a?.value ?? a?.reading ?? a?.val ?? a?.amount ?? null;
      if (v === null || v === undefined) return null;
      return typeof v === "string" || typeof v === "number"
        ? v
        : JSON.stringify(v);
    };

    const humanLabel = (typeRaw: string) => {
      const t = typeRaw.toLowerCase();
      if (t.includes("spo2") || t.includes("oxygen"))
        return "SpO2 dropped below normal";
      if (t.includes("heart") || t.includes("hr") || t.includes("pulse"))
        return "Heart rate spiked above normal";
      if (t.includes("blood") || t.includes("bp") || t.includes("pressure"))
        return "Blood pressure elevated";
      if (t.includes("temp") || t.includes("fever"))
        return "Temperature rose above normal";
      if (t.includes("sleep")) return "Sleep dropped below normal";
      if (t.includes("hydr") || t.includes("water"))
        return "Hydration was lower than usual";
      return typeRaw;
    };

    const humanExplanation = (typeRaw: string) => {
      const t = typeRaw.toLowerCase();
      if (t.includes("spo2") || t.includes("oxygen")) {
        return "Oxygen levels dipped below the normal range, which can indicate exertion, stress, or reduced breathing efficiency.";
      }
      if (t.includes("heart") || t.includes("hr") || t.includes("pulse")) {
        return "Heart rate increased above your typical range, which may reflect stress, dehydration, or reduced recovery.";
      }
      if (t.includes("blood") || t.includes("bp") || t.includes("pressure")) {
        return "Blood pressure was higher than usual, which can increase cardiovascular strain and warrants monitoring if persistent.";
      }
      if (t.includes("temp") || t.includes("fever")) {
        return "Body temperature rose above normal, which may be linked to infection, dehydration, or environmental heat.";
      }
      if (t.includes("sleep")) {
        return "Sleep dropped below your usual range, which can reduce recovery and amplify other stress signals.";
      }
      if (t.includes("hydr") || t.includes("water")) {
        return "Hydration appears lower than usual, which can contribute to fatigue and increased cardiovascular load.";
      }
      return "This pattern deviated from your typical range and may contribute to your overall risk profile.";
    };

    const groups: Record<
      string,
      {
        key: string;
        typeRaw: string;
        label: string;
        severity: "high" | "moderate" | "low";
        items: any[];
        latestAt: Date | null;
        latestValue: string | number | null;
        explanation: string;
      }
    > = {};

    for (const a of anomalies) {
      const typeRaw = getType(a);
      const key = normalizeTypeKey(typeRaw);
      const severity = getSeverity(a);
      const ts = asDate(getTimestamp(a));
      const val = getValue(a);

      if (!groups[key]) {
        groups[key] = {
          key,
          typeRaw,
          label: humanLabel(typeRaw),
          severity,
          items: [a],
          latestAt: ts,
          latestValue: val,
          explanation: humanExplanation(typeRaw),
        };
      } else {
        groups[key].items.push(a);
        // Keep API as truth: don't recompute severity; just show the highest severity within the group for display.
        const rank = (s: string) =>
          s === "high" ? 2 : s === "moderate" ? 1 : 0;
        if (rank(severity) > rank(groups[key].severity))
          groups[key].severity = severity as any;
        if (ts && (!groups[key].latestAt || ts > groups[key].latestAt)) {
          groups[key].latestAt = ts;
          groups[key].latestValue = val;
        }
      }
    }

    const list = Object.values(groups).sort((a, b) => {
      const at = a.latestAt?.getTime() ?? 0;
      const bt = b.latestAt?.getTime() ?? 0;
      return bt - at;
    });

    const todayKey = format(new Date(), "yyyy-MM-dd");
    const isToday = (d: Date | null) =>
      d ? format(d, "yyyy-MM-dd") === todayKey : true;

    const summaryLine = (() => {
      if (list.length === 0) return null;
      const topics = list.slice(0, 2).map((g) => {
        const t = g.typeRaw.toLowerCase();
        if (t.includes("spo2") || t.includes("oxygen")) return "oxygen levels";
        if (t.includes("heart") || t.includes("hr") || t.includes("pulse"))
          return "heart rate";
        if (t.includes("blood") || t.includes("bp") || t.includes("pressure"))
          return "blood pressure";
        if (t.includes("temp") || t.includes("fever")) return "temperature";
        if (t.includes("sleep")) return "sleep";
        if (t.includes("hydr") || t.includes("water")) return "hydration";
        return g.typeRaw.toLowerCase();
      });

      const uniq = Array.from(new Set(topics));
      if (uniq.length === 1) return `Recent anomalies detected in ${uniq[0]}`;
      return `Recent anomalies detected in ${uniq[0]} and ${uniq[1]}`;
    })();

    // Timeline grouping: prioritize "Today" without changing data.
    const today = list.filter((g) => isToday(g.latestAt));
    const notToday = list.filter((g) => !isToday(g.latestAt));
    const groupedForUi = today.length > 0 ? today : list;

    return {
      grouped: groupedForUi,
      summaryLine,
      hasEarlier: notToday.length > 0,
    };
  }, [aiAnomalies]);

  useEffect(() => {
    const fetchEnhancedInsights = async () => {
      if (!structuredInsights || structuredInsights.length === 0) return;

      setLoadingEnhancedInsights(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-endpoint`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ issues: structuredInsights }),
          },
        );

        if (!response.ok) throw new Error("API failed");

        const data = await response.json();
        if (data && data.insights && Array.isArray(data.insights)) {
          setEnhancedInsights(data.insights);
        } else {
          setEnhancedInsights([]); // fallback to rule-based
        }
      } catch (error) {
        console.error("AI Insights Error:", error);
        setEnhancedInsights([]); // fallback
      } finally {
        setLoadingEnhancedInsights(false);
      }
    };

    fetchEnhancedInsights();
  }, [structuredInsights]);

  const riskPrediction = useMemo(() => {
    let outlook = "";
    let reason = "";
    let preventive = "";
    let confidence = 75;

    const { trend, isHighBP, isHighHR, pct } = healthContext;

    if (trend === "increasing") {
      outlook =
        "Your health risk is likely to increase over the next 24–48 hours if current patterns persist";
      reason = isHighBP
        ? "Driven by rising blood pressure trends and recent anomalies."
        : "Observed upward trend in vital variability and reduced recovery markers.";
      preventive =
        "Improve hydration and prioritize rest to prevent further risk increase.";
      confidence = 82;
    } else if (trend === "decreasing") {
      outlook =
        "Your health risk is likely to improve over the next 24–48 hours if current trends continue";
      reason =
        "Recent data shows stabilizing vitals and improved physiological recovery.";
      preventive =
        "Maintain your current hydration and sleep schedule to support this trend.";
      confidence = 88;
    } else {
      outlook =
        "Your condition is likely to remain stable in the next 2–3 days if current patterns continue";
      reason =
        "Vitals are fluctuating within expected ranges with no new anomalies detected.";
      preventive =
        "Continue regular monitoring and follow your daily health plan.";
      confidence = 92;
    }

    return {
      outlook,
      reason,
      preventive,
      arrow: riskTrendInsight.arrow,
      color: riskTrendInsight.color,
      confidence,
    };
  }, [healthContext, riskTrendInsight]);

  const generateHealthSummary = (vitals: any[], water: any[], sleep: any) => {
    if (!vitals || vitals.length === 0) return;

    const latest = vitals[vitals.length - 1];
    const hr = latest.heart_rate;
    const sys = latest.systolic_bp;
    const dia = latest.diastolic_bp;
    const spo2 = latest.spo2;
    const temp = latest.temperature;

    const totalWater = water.reduce(
      (sum, r) => sum + (r.amount_liters || 0),
      0,
    );
    const sleepHours = sleep?.sleep_hours || 0;

    const healthData: RiskHealthData = {
      heart_rate: hr,
      bp_systolic: sys,
      bp_diastolic: dia,
      spo2: spo2,
      temperature: temp,
      sleep_hours: sleepHours,
      water_intake: totalWater,
      water_goal: 2.5,
    };

    const risk = calculateEngineRiskScore(healthData);

    let status = "Stable";
    let severity: "low" | "medium" | "high" = "low";

    // Determine trend from vitals history
    const firstRisk =
      vitals.length > 1
        ? calculateEngineRiskScore({
            heart_rate: vitals[0].heart_rate,
            bp_systolic: vitals[0].systolic_bp,
            bp_diastolic: vitals[0].diastolic_bp,
            spo2: vitals[0].spo2,
            temperature: vitals[0].temperature,
            sleep_hours: 8,
            water_intake: 2.0,
            water_goal: 2.5,
          }).score
        : risk.score;

    const diff = risk.score - firstRisk;
    const pct = firstRisk !== 0 ? Math.round((diff / firstRisk) * 100) : 0;
    const trend =
      Math.abs(pct) < 5 ? "stable" : diff > 0 ? "increasing" : "decreasing";

    setHealthContext({
      trend,
      diff,
      pct,
      isHighBP: sys >= 140 || dia >= 90,
      isHighHR: hr > 100,
      isLowOxygen: spo2 < 95,
      isHighTemp: temp > 37.5,
      isLowSleep: sleepHours < 6,
      isLowHydration: totalWater < 1.5,
    });

    setLatestLogs({
      water: totalWater,
      sleep: sleepHours,
      mood: "Neutral", // fallback until we have a mood table
    });

    if (risk.score > 60) {
      status = "Critical";
      severity = "high";
    } else if (risk.score > 30) {
      status = trend === "increasing" ? "Increasing Risk" : "Stable (Elevated)";
      severity = "medium";
    }

    const issues: string[] = [];
    if (sys > 140 || dia > 90) issues.push("elevated blood pressure");
    if (hr > 100) issues.push("high heart rate");
    if (spo2 < 95) issues.push("lower oxygen levels");
    if (temp > 37.5) issues.push("mild fever");

    const supporting: string[] = [];
    if (sleepHours < 6) supporting.push("inadequate sleep");
    if (totalWater < 1.5) supporting.push("low hydration");

    const mainCause = issues.length > 0 ? issues[0] : "None detected";

    let summary = `Your overall health status is currently ${status.toLowerCase()}. `;
    if (issues.length > 0) {
      summary += `The primary concern is ${issues.join(" and ")}, `;
      if (supporting.length > 0) {
        summary += `potentially exacerbated by ${supporting.join(" and ")}. `;
      }
    } else {
      summary += "All major vitals are within healthy ranges. ";
    }

    let recommendation =
      "Maintain your current healthy routine and keep logging your vitals.";
    if (severity === "high")
      recommendation =
        "Please contact your healthcare provider immediately to discuss these readings.";
    else if (severity === "medium")
      recommendation =
        "Prioritize rest, increase hydration, and recheck your vitals in 2 hours.";

    setHealthSummary({
      summary,
      status,
      mainCause,
      recommendation,
      severity,
    });
  };

  const processAnomalies = (vitals: any[]) => {
    if (!vitals || vitals.length === 0) return;

    const anomalies: any[] = [];
    const counts: Record<string, number> = {};

    vitals.forEach((v) => {
      const hr = v.heart_rate;
      const sys = v.systolic_bp;
      const spo2 = v.spo2;

      if (hr > 110) {
        counts["Heart Rate"] = (counts["Heart Rate"] || 0) + 1;
        anomalies.push({
          vital: "Heart Rate",
          value: hr,
          expected: "60-100",
          date: format(new Date(v.recorded_at), "MMM d, HH:mm"),
          impact:
            "This elevated heart rate is above expected range and contributes to cardiovascular stress",
          severity: "High",
          repeat: counts["Heart Rate"] > 1,
        });
      }

      if (sys >= 140) {
        counts["Blood Pressure"] = (counts["Blood Pressure"] || 0) + 1;
        anomalies.push({
          vital: "Blood Pressure",
          value: `${sys} mmHg`,
          expected: "90-120",
          date: format(new Date(v.recorded_at), "MMM d, HH:mm"),
          impact:
            sys >= 160
              ? "Critically high blood pressure reading requires immediate attention"
              : "This high blood pressure reading increases overall health risk and requires monitoring",
          severity: sys >= 160 ? "Critical" : "High",
          repeat: counts["Blood Pressure"] > 1,
        });
      }

      if (spo2 < 94) {
        counts["SpO2"] = (counts["SpO2"] || 0) + 1;
        anomalies.push({
          vital: "SpO2",
          value: `${spo2}%`,
          expected: "95-100%",
          date: format(new Date(v.recorded_at), "MMM d, HH:mm"),
          impact:
            "Low oxygen levels may affect breathing efficiency and require attention",
          severity: "Moderate",
          repeat: counts["SpO2"] > 1,
        });
      }
    });

    setDetectedAnomalies(anomalies.reverse().slice(0, 3));
  };

  const chartTrendLabel = useMemo(() => {
    if (chartData.length < 6) return "Analyzing...";
    const lastSix = chartData.slice(-6);
    const firstHR = lastSix[0].hr;
    const lastHR = lastSix[lastSix.length - 1].hr;
    const diff = lastHR - firstHR;
    if (Math.abs(diff) < 3) return "Stable";
    if (diff > 0) return "Increasing risk";
    return "Fluctuating";
  }, [chartData]);

  const eventAnnotations = useMemo(() => {
    const annotations: any[] = [];
    if (chartData.length < 3) return annotations;

    for (let i = 2; i < chartData.length; i++) {
      const window = chartData.slice(i - 2, i + 1);
      const allHighHR = window.every((d) => d.hr > 100);
      const allHighBP = window.every((d) => d.systolic > 140);

      if (allHighHR) {
        annotations.push({ index: i, label: "Stress spike", color: "#ef4444" });
        i += 2; // skip
      } else if (allHighBP && window.every((d) => d.hr > 90)) {
        annotations.push({
          index: i,
          label: "Possible dehydration pattern",
          color: "#f59e0b",
        });
        i += 2;
      }
    }
    return annotations.slice(-2); // Only show max 2 major events to reduce clutter
  }, [chartData]);

  const highlightText = (text: string) => {
    if (!text) return "";
    const keywords = [
      "stable",
      "risk",
      "high",
      "low",
      "caution",
      "normal",
      "improving",
      "fluctuating",
      "concern",
      "preeclampsia",
      "dehydration",
    ];
    let parts: (string | React.ReactNode)[] = [text];

    keywords.forEach((kw) => {
      const newParts: (string | React.ReactNode)[] = [];
      parts.forEach((part) => {
        if (typeof part !== "string") {
          newParts.push(part);
          return;
        }

        const regex = new RegExp(`(${kw})`, "gi");
        const split = part.split(regex);
        split.forEach((s, i) => {
          if (s.toLowerCase() === kw.toLowerCase()) {
            newParts.push(
              <span
                key={`${kw}-${i}`}
                className="text-blue-600 font-black underline decoration-blue-200/50 decoration-2 underline-offset-2"
              >
                {s}
              </span>,
            );
          } else if (s) {
            newParts.push(s);
          }
        });
      });
      parts = newParts;
    });

    return <>{parts}</>;
  };

  const handleGenerateSummary = async () => {
    if (!user || chartData.length === 0) return;

    setLoadingSummary(true);
    setAiThinkingMessage("Reading your vitals...");

    // Sequential thinking experience
    await new Promise((r) => setTimeout(r, 800));
    setAiThinkingMessage("Analyzing patterns...");
    await new Promise((r) => setTimeout(r, 1000));
    setAiThinkingMessage("Generating insights...");
    await new Promise((r) => setTimeout(r, 600));

    try {
      const latest = chartData[chartData.length - 1];
      const riskScore = summaryMetrics.riskScore;

      const vitals = {
        heart_rate: latest.hr || 0,
        bp: `${latest.systolic || 0}/${latest.diastolic || 0}`,
        spo2: latest.spo2 || 0,
        temp: latest.temperature || latest.temp || 0,
      };

      const logs = {
        sleep: latestLogs.sleep || 0,
        water: latestLogs.water || 0,
        mood: latestLogs.mood || "Neutral",
      };

      console.log("Sending to API:", { vitals, logs });

      const url =
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-endpoint`;
      const headers = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ vitals, logs }),
      });

      if (!response.ok) {
        throw new Error("Summary request failed");
      }

      const data = await response.json();
      console.log("API response (Summary):", data);

      // Extract severity and content from response or calculate based on riskScore
      const severity: "low" | "medium" | "high" =
        riskScore <= 30 ? "low" : riskScore <= 70 ? "medium" : "high";

      const result = {
        summary:
          data.summary ||
          "Health synthesis complete. Your vitals show a stable trend with no immediate concerns.",
        concern: data.concern || "No major physiological concerns detected.",
        action:
          data.action ||
          "Continue with your current health routine and monitor vitals daily.",
        confidence: data.confidence || 95,
        severity: data.severity || severity,
      };

      setAiStructuredResponse(result);
      setLastAnalyzed(new Date());

      // Original data updates for backward compatibility
      setAiSummary(result.summary);
      setAiMainFactor(result.concern);
      setAiAction(result.action);
    } catch (error) {
      console.error("AI Summary Error:", error);
      setAiStructuredResponse({
        summary:
          "Unable to fetch analysis. Please check your connection and try again.",
        concern: "Data synthesis interrupted.",
        action: "Please try re-analyzing in a moment.",
        confidence: 0,
        severity: "low",
      });
    } finally {
      setLoadingSummary(false);
      setAiThinkingMessage("");
    }
  };

  const handlePredictRisk = async () => {
    if (!user || chartData.length === 0) return;

    setLoadingRiskPrediction(true);
    setRiskThinkingMessage("Processing 24h vital history...");

    await new Promise((r) => setTimeout(r, 1000));
    setRiskThinkingMessage("Simulating physiological trends...");
    await new Promise((r) => setTimeout(r, 1200));
    setRiskThinkingMessage("Detecting high-probability events...");
    await new Promise((r) => setTimeout(r, 800));

    try {
      const latest = chartData[chartData.length - 1];
      const vitals = {
        heart_rate: latest.hr || 0,
        bp: `${latest.systolic || 0}/${latest.diastolic || 0}`,
        spo2: latest.spo2 || 0,
        temp: latest.temperature || latest.temp || 0,
      };
      const logs = {
        sleep: latestLogs.sleep || 0,
        water: latestLogs.water || 0,
        mood: latestLogs.mood || "Neutral",
      };

      console.log("Sending to API (Risk):", { vitals, logs, risk: true });

      const url =
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-endpoint`;
      const headers = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ vitals, logs, risk: true }),
      });

      if (!response.ok) throw new Error("Risk prediction failed");

      const data = await response.json();
      console.log("API response (Risk):", data);

      // Extract structured data or generate realistic mocks if missing
      const outlook = data.outlook || "Stable Health Condition";
      const reason = data.reason || "Vitals are within expected ranges.";
      const prevention = data.prevention || "Continue regular monitoring.";

      // Intelligent mock generation based on healthContext
      const isHighRisk =
        healthContext.trend === "increasing" ||
        healthContext.isHighBP ||
        healthContext.isHighHR;

      const predictedEvents: {
        time: string;
        event: string;
        probability: number;
        impact: "high" | "medium" | "low";
      }[] = [
        {
          time: "Tonight (10 PM - 2 AM)",
          event: isHighRisk
            ? "Potential BP Elevation"
            : "Restful Recovery Window",
          probability: isHighRisk ? 68 : 85,
          impact: isHighRisk ? "high" : "low",
        },
        {
          time: "Tomorrow Morning",
          event: healthContext.isLowHydration
            ? "Dehydration Warning"
            : "Optimal Vital State",
          probability: healthContext.isLowHydration ? 72 : 90,
          impact: "medium",
        },
      ];

      const impactFactors: {
        factor: string;
        weight: number;
        status: "improving" | "worsening" | "stable";
      }[] = [
        {
          factor: "Sleep Quality",
          weight: 35,
          status: healthContext.isLowSleep ? "worsening" : "stable",
        },
        {
          factor: "Vital Stability",
          weight: 45,
          status:
            healthContext.trend === "increasing" ? "worsening" : "improving",
        },
        {
          factor: "Hydration",
          weight: 20,
          status: healthContext.isLowHydration ? "worsening" : "stable",
        },
      ];

      setAiRiskData({
        outlook,
        reason,
        prevention,
        predictedEvents,
        impactFactors,
        confidence: isHighRisk ? 78 : 92,
      });

      // Update trajectory graph with AI's "vision"
      const lastPoint =
        riskTrajectoryData.find((d) => !d.isFuture && d.isNow) ||
        riskTrajectoryData[riskTrajectoryData.length - 1];
      const futurePoints = [];
      const trendFactor = isHighRisk ? 1.8 : -0.8;

      for (let i = 1; i <= 6; i++) {
        const baseValue = lastPoint
          ? lastPoint.risk || lastPoint.predictedRisk
          : 20;
        const noise = Math.sin(i * 1.5) * 3 + Math.random() * 2;
        const val = Math.max(
          5,
          Math.min(95, baseValue + i * trendFactor + noise),
        );

        futurePoints.push({
          time: `+${i * 4}h`,
          predictedRisk: Math.round(val),
          isFuture: true,
          confidenceRange: [
            Math.max(0, val - 5 - i),
            Math.min(100, val + 5 + i),
          ],
        });
      }

      const pastData = riskTrajectoryData.filter((d) => !d.isFuture);
      setRiskTrajectoryData([...pastData, ...futurePoints]);
    } catch (error) {
      console.error("Risk Prediction Error:", error);
      setAiRiskData({
        outlook: "Unable to fetch analysis",
        reason: "The prediction engine encountered an error.",
        prevention: "Please try again later.",
        confidence: 0,
      });
    } finally {
      setLoadingRiskPrediction(false);
      setRiskThinkingMessage("");
      setIsRiskExpanded(true);
    }
  };

  const fetchAnomalies = async () => {
    if (!user || chartData.length === 0) return;

    setLoadingAnomalies(true);
    try {
      const latest = chartData[chartData.length - 1];
      const vitals = {
        heart_rate: latest.hr || 0,
        bp: `${latest.systolic || 0}/${latest.diastolic || 0}`,
        spo2: latest.spo2 || 0,
        temp: latest.temperature || latest.temp || 0,
      };
      const logs = {
        sleep: latestLogs.sleep || 0,
        water: latestLogs.water || 0,
        mood: latestLogs.mood || "Neutral",
      };

      console.log("Sending to API:", { vitals, logs, anomaly: true });

      const url =
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-endpoint`;
      const headers = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ vitals, logs, anomaly: true }),
      });

      if (!response.ok) throw new Error("Anomaly detection failed");

      const data = await response.json();
      console.log("API response (Anomaly):", data);

      setAiAnomalies(Array.isArray(data?.anomalies) ? data.anomalies : []);
    } catch (error) {
      console.error("Anomaly Detection Error:", error);
      setAiAnomalies([]);
    } finally {
      setLoadingAnomalies(false);
    }
  };

  const fetchAnalyticsData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadingProgress(10);

    const messages = [
      "Analyzing recent vitals...",
      "Refreshing trends...",
      "Recalculating insights...",
      "Syncing health data...",
      "Processing AI intelligence...",
    ];
    setLoadingMessage(messages[Math.floor(Math.random() * messages.length)]);

    try {
      setLoadingProgress(30);
      const days = period === "24H" ? 1 : period === "7D" ? 7 : 30;
      const today = new Date().toISOString().split("T")[0];
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      const prevStartDate = startOfDay(
        subDays(new Date(), days * 2),
      ).toISOString();

      setLoadingProgress(50);
      const [
        { data: vitalsData, error: vitalsError },
        { data: prevVitalsData, error: prevVitalsError },
        { data: waterData, error: waterError },
        { data: sleepData, error: sleepError },
      ] = await Promise.all([
        supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .gte("recorded_at", startDate)
          .order("recorded_at", { ascending: true }),
        supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .gte("recorded_at", prevStartDate)
          .lt("recorded_at", startDate)
          .order("recorded_at", { ascending: true }),
        supabase
          .from("water_intake")
          .select("*")
          .eq("user_id", user.id)
          .gte("recorded_at", `${today}T00:00:00`),
        supabase
          .from("sleep_data")
          .select("*")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (vitalsError) throw vitalsError;
      if (prevVitalsError) throw prevVitalsError;
      setLoadingProgress(80);

      const totalWater = (waterData || []).reduce(
        (sum, r) => sum + (r.amount_liters || 0),
        0,
      );
      const sleepHours = sleepData?.sleep_hours || 8;

      const mappedData = (vitalsData || []).map((r) => ({
        time:
          period === "24H"
            ? formatDistanceToNow(new Date(r.recorded_at), {
                addSuffix: true,
              }).replace("about ", "")
            : format(new Date(r.recorded_at), "MMM d"),
        hr: r.heart_rate,
        bp: r.systolic_bp,
        systolic: r.systolic_bp,
        diastolic: r.diastolic_bp,
        spo2: r.spo2,
        temp: r.temperature,
        temperature: r.temperature,
      }));

      setChartData(mappedData);
      setLoadingProgress(95);

      // Helper function to calculate metrics from vitals array
      const calculateSetMetrics = (data: any[]) => {
        if (!data || data.length === 0)
          return { risk: 0, critical: 0, hr: 0, anomalies: 0 };

        const avgHR = Math.round(
          data.reduce((sum, v) => sum + (v.heart_rate || 0), 0) / data.length,
        );
        const critical = data.filter(
          (v) =>
            v.heart_rate > 120 ||
            v.systolic_bp >= 160 ||
            v.spo2 < 92 ||
            v.temperature > 38,
        ).length;
        const anomalies = data.filter((v) => {
          const isAbnormalHR = v.heart_rate < 60 || v.heart_rate > 100;
          const isAbnormalBP = v.systolic_bp >= 120;
          const isAbnormalSpO2 = v.spo2 < 95;
          const isAbnormalTemp = v.temperature > 37.5;
          return (
            isAbnormalHR || isAbnormalBP || isAbnormalSpO2 || isAbnormalTemp
          );
        }).length;

        // Simplified risk calculation for sets
        const avgSys =
          data.reduce((sum, v) => sum + (v.systolic_bp || 0), 0) / data.length;
        const avgSpO2 =
          data.reduce((sum, v) => sum + (v.spo2 || 0), 0) / data.length;
        const risk = calculateRiskScore(
          { heart_rate: avgHR, systolic: avgSys, spo2: avgSpO2 },
          { sleep: sleepHours, water: totalWater },
        );

        return { risk, critical, hr: avgHR, anomalies };
      };

      const currentMetrics = calculateSetMetrics(vitalsData || []);
      const prevMetrics = calculateSetMetrics(prevVitalsData || []);

      const getTrend = (
        curr: number,
        prev: number,
      ): "up" | "down" | "stable" => {
        if (curr > prev) return "up";
        if (curr < prev) return "down";
        return "stable";
      };

      const metadata: Record<string, any> = {
        risk: {
          trend: getTrend(currentMetrics.risk, prevMetrics.risk),
          trendValue: `${Math.abs(currentMetrics.risk - prevMetrics.risk)} pts`,
          context:
            currentMetrics.risk <= 25
              ? "Within safe range"
              : currentMetrics.risk <= 50
                ? "Stable this week"
                : "Slight increase observed",
          explanation:
            currentMetrics.risk > prevMetrics.risk
              ? "Slight increase due to vital fluctuations."
              : "Stable risk profile maintained.",
          readings: vitalsData?.length || 0,
          updatedAt: new Date().toISOString(),
        },
        critical: {
          trend: getTrend(currentMetrics.critical, prevMetrics.critical),
          trendValue: `${Math.abs(currentMetrics.critical - prevMetrics.critical)} events`,
          context:
            currentMetrics.critical === 0
              ? "Zero critical events"
              : "Alerts generated",
          explanation:
            currentMetrics.critical > 0
              ? `Driven by ${currentMetrics.critical} threshold breaches.`
              : "No major threshold breaches.",
          readings: vitalsData?.length || 0,
          updatedAt: new Date().toISOString(),
        },
        hr: {
          trend: getTrend(currentMetrics.hr, prevMetrics.hr),
          trendValue: `${Math.abs(currentMetrics.hr - prevMetrics.hr)} bpm`,
          context:
            currentMetrics.hr < 90 ? "Healthy heart rate" : "Slightly elevated",
          explanation:
            currentMetrics.hr > prevMetrics.hr
              ? "Average rate is trending higher."
              : "Heart rate is stabilizing.",
          readings: vitalsData?.length || 0,
          updatedAt: new Date().toISOString(),
        },
        anomalies: {
          trend: getTrend(currentMetrics.anomalies, prevMetrics.anomalies),
          trendValue: `${Math.abs(currentMetrics.anomalies - prevMetrics.anomalies)} points`,
          context:
            currentMetrics.anomalies === 0
              ? "Perfect consistency"
              : "Minor deviations",
          explanation:
            currentMetrics.anomalies > 0
              ? `Detected ${currentMetrics.anomalies} non-baseline points.`
              : "Vitals are highly consistent.",
          readings: vitalsData?.length || 0,
          updatedAt: new Date().toISOString(),
        },
      };

      setMetricMetadata(metadata);
      setSummaryMetrics({
        riskScore: currentMetrics.risk,
        criticalEvents: currentMetrics.critical,
        avgHeartRate: currentMetrics.hr,
        anomaliesCount: currentMetrics.anomalies,
      });
      // --- End Dynamic Metrics ---

      // Generate Risk Trajectory Data for the selected period (Past + Future)
      // First, create a time-normalized base for the selected period
      const intervalHours = period === "24H" ? 2 : period === "7D" ? 12 : 24;
      const numPoints = period === "24H" ? 12 : 14; // Past points

      const normalizedPast = Array.from({ length: numPoints }, (_, i) => {
        const date = subDays(
          new Date(),
          (numPoints - 1 - i) * (intervalHours / 24),
        );
        const timeLabel =
          period === "24H"
            ? formatDistanceToNow(date, { addSuffix: true }).replace(
                "about ",
                "",
              )
            : format(date, "MMM d");

        // Find closest real reading
        const closestReading = (vitalsData || []).reduce(
          (prev, curr) => {
            const currDiff = Math.abs(
              new Date(curr.recorded_at).getTime() - date.getTime(),
            );
            const prevDiff = Math.abs(
              new Date(prev.recorded_at).getTime() - date.getTime(),
            );
            return currDiff < prevDiff ? curr : prev;
          },
          (vitalsData || [])[0],
        );

        let actualRisk = 20; // default base risk
        if (closestReading) {
          actualRisk = calculateRiskScore(
            {
              heart_rate: closestReading.heart_rate,
              systolic: closestReading.systolic_bp,
              spo2: closestReading.spo2,
              temp: closestReading.temperature,
            },
            { sleep: sleepHours, water: totalWater },
          );
        }

        // Add some "jitter" for realism if data is sparse
        const jitter = closestReading ? 0 : Math.sin(i) * 5;
        actualRisk = Math.max(5, Math.min(95, actualRisk + jitter));

        return {
          time: timeLabel,
          risk: Math.round(actualRisk),
          predictedRisk: Math.round(
            Math.max(
              5,
              Math.min(95, actualRisk + Math.sin(i) * 3 + Math.random() * 2),
            ),
          ),
          isFuture: false,
          isNow: i === numPoints - 1,
        };
      });

      // Weighted smoothing
      const pastTrajectory = normalizedPast.map((p, i, arr) => {
        if (i === 0) return p;
        const prev = arr[i - 1].risk;
        const prev2 = i > 1 ? arr[i - 2].risk : prev;
        return {
          ...p,
          risk: Math.round(p.risk * 0.5 + prev * 0.3 + prev2 * 0.2),
          predictedRisk: Math.round(
            p.predictedRisk * 0.5 +
              arr[i - 1].predictedRisk * 0.3 +
              (i > 1
                ? arr[i - 2].predictedRisk * 0.2
                : arr[i - 1].predictedRisk * 0.5),
          ),
        };
      });

      const lastPoint = pastTrajectory[pastTrajectory.length - 1];
      const futurePoints = [{ ...lastPoint, isFuture: true, isNow: false }];
      const trendFactor =
        healthContext.trend === "increasing"
          ? 1.5
          : healthContext.trend === "decreasing"
            ? -1.2
            : 0.3;

      for (let i = 1; i <= 4; i++) {
        // Add more creative noise/fluctuation for realism
        const fluctuation =
          Math.sin(i * 1.8) * 4 + Math.cos(i * 0.5) * 2 + Math.random() * 3;
        const predictedRiskValue = Math.max(
          5,
          Math.min(
            95,
            lastPoint.predictedRisk + i * trendFactor * 1.5 + fluctuation,
          ),
        );

        futurePoints.push({
          time: period === "24H" ? `+${i * 4}h` : `Day +${i}`,
          risk: undefined,
          predictedRisk: Math.round(predictedRiskValue),
          confidenceRange: [
            Math.max(0, Math.round(predictedRiskValue - 5 - i)),
            Math.min(100, Math.round(predictedRiskValue + 5 + i)),
          ],
          isFuture: true,
          isNow: false,
        } as any);
      }

      setRiskTrajectoryData([...pastTrajectory, ...futurePoints]);

      if (vitalsData && vitalsData.length > 0) {
        setLatestLogs({
          water: totalWater,
          sleep: sleepHours,
          mood: "Neutral",
        });
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoadingProgress(100);
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 500);
    }
  }, [user, period]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  useEffect(() => {
    if (chartData.length > 0) {
      fetchAnomalies();
    }
  }, [chartData]);

  const dynamicSummaryCards = useMemo(() => {
    const { riskScore, criticalEvents, avgHeartRate, anomaliesCount } =
      summaryMetrics;

    // Risk Score color logic: 0–25 Green, 26–50 Yellow, 51–75 Orange, 76–100 Red
    const riskStyle = (() => {
      if (riskScore <= 25)
        return {
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          border: "border-emerald-100",
          accent: "bg-emerald-500",
        };
      if (riskScore <= 50)
        return {
          color: "text-yellow-600",
          bg: "bg-yellow-50",
          border: "border-yellow-100",
          accent: "bg-yellow-500",
        };
      if (riskScore <= 75)
        return {
          color: "text-orange-600",
          bg: "bg-orange-50",
          border: "border-orange-100",
          accent: "bg-orange-500",
        };
      return {
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-100",
        accent: "bg-red-500",
      };
    })();

    return [
      {
        id: "risk",
        label: "Avg Risk Score",
        value: riskScore,
        unit: "/100",
        ...riskStyle,
      },
      {
        id: "critical",
        label: "Critical Events",
        value: criticalEvents,
        unit: "this period",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-100",
        accent: "bg-red-500",
      },
      {
        id: "hr",
        label: "Avg Heart Rate",
        value: avgHeartRate,
        unit: "bpm",
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-100",
        accent: "bg-blue-500",
      },
      {
        id: "anomalies",
        label: "Anomalies",
        value: anomaliesCount,
        unit: "detected",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-100",
        accent: "bg-amber-500",
      },
    ];
  }, [summaryMetrics]);

  return (
    <div className="space-y-6 relative">
      {/* Top Progress Bar */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${loadingProgress}%`, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 h-1 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] z-[9999] transition-all duration-300 ease-out"
          />
        )}
      </AnimatePresence>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Analytics & Intelligence</h1>
          <p className="page-subtitle">
            Multi-dimensional health trend analysis and AI insights.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 bg-white/80 backdrop-blur-md border border-gray-100 p-1 rounded-2xl shadow-sm relative overflow-hidden">
            {periods.map((p) => (
              <motion.button
                key={p}
                onClick={() => setPeriod(p)}
                whileHover={{ scale: 1.03, filter: "brightness(1.1)" }}
                whileTap={{ scale: 0.95 }}
                className={`relative text-[11px] px-4 py-2 rounded-xl font-bold transition-all duration-300 z-10 ${
                  period === p
                    ? "text-white"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {p}
                {period === p && (
                  <motion.div
                    layoutId="activePeriodAnalytics"
                    className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-lg shadow-blue-200/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 opacity-95" />
                    <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_8px_rgba(255,255,255,0.3)]" />
                    <div className="absolute -inset-[1px] rounded-xl bg-blue-400/20 blur-[2px] -z-20" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={loading ? loadingMessage : period}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
            >
              {loading ? (
                <span className="flex items-center gap-1.5 text-blue-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {loadingMessage}
                </span>
              ) : (
                `Analyzing last ${period === "24H" ? "24 hours" : period === "7D" ? "7 days" : "30 days"}`
              )}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={period}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="space-y-6"
        >
          {/* ── AI PANELS: side-by-side ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── AI HEALTH SUMMARY ───────────────────────────────── */}
            <div
              className={`card p-0 border-2 transition-all duration-500 relative overflow-hidden shadow-lg hover:shadow-xl ${
                aiStructuredResponse?.severity === "high"
                  ? "border-red-100"
                  : aiStructuredResponse?.severity === "medium"
                    ? "border-amber-100"
                    : "border-gray-100"
              } bg-white`}
            >
              <div
                className={`absolute inset-0 opacity-[0.04] pointer-events-none bg-gradient-to-br ${
                  aiStructuredResponse?.severity === "high"
                    ? "from-red-600 via-rose-500 to-transparent"
                    : aiStructuredResponse?.severity === "medium"
                      ? "from-amber-500 via-orange-400 to-transparent"
                      : "from-violet-600 via-blue-500 to-transparent"
                }`}
              />
              <div
                className={`absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-[0.06] pointer-events-none ${
                  aiStructuredResponse?.severity === "high"
                    ? "bg-red-500"
                    : aiStructuredResponse?.severity === "medium"
                      ? "bg-amber-400"
                      : "bg-violet-500"
                }`}
              />

              <div className="p-5 relative z-10 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl shadow-sm transition-all duration-700 ${
                        loadingSummary
                          ? "bg-violet-600 text-white animate-bounce"
                          : aiStructuredResponse?.severity === "high"
                            ? "bg-red-50 text-red-600"
                            : aiStructuredResponse?.severity === "medium"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-violet-50 text-violet-600"
                      }`}
                    >
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-black text-gray-900 tracking-tight">
                          AI Health Summary
                        </h2>
                        {aiStructuredResponse && (
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border animate-pulse ${
                              aiStructuredResponse.severity === "high"
                                ? "bg-red-50 text-red-600 border-red-100"
                                : aiStructuredResponse.severity === "medium"
                                  ? "bg-amber-50 text-amber-600 border-amber-100"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            }`}
                          >
                            <Activity className="w-2.5 h-2.5" />
                            {aiStructuredResponse.severity === "high"
                              ? "High Risk"
                              : aiStructuredResponse.severity === "medium"
                                ? "Moderate"
                                : "Stable"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        Real-Time Health Synthesis
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={loadingSummary}
                    className={`relative group/btn px-4 py-2 rounded-xl font-black text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 overflow-hidden uppercase tracking-wide ${
                      loadingSummary
                        ? "bg-gray-100 text-gray-400"
                        : aiStructuredResponse?.severity === "high"
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : aiStructuredResponse?.severity === "medium"
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "bg-violet-600 text-white hover:bg-violet-700"
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                    {loadingSummary ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10" />
                    ) : (
                      <Brain className="w-3.5 h-3.5 relative z-10" />
                    )}
                    <span className="relative z-10">
                      {loadingSummary
                        ? aiThinkingMessage || "Analyzing..."
                        : "Analyze with AI"}
                    </span>
                  </button>
                </div>

                {/* Body */}
                {loadingSummary ? (
                  <div className="flex flex-col items-center justify-center py-10 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/40 gap-4">
                    <div className="relative">
                      <motion.div
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.2, 0.5, 0.2],
                        }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="absolute inset-0 bg-violet-500 rounded-full blur-2xl"
                      />
                      <div className="relative w-14 h-14 rounded-full border-4 border-violet-50 border-t-violet-600 animate-spin shadow-lg" />
                      <Brain className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-violet-600 animate-pulse">
                        {aiThinkingMessage || "Processing..."}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Synthesizing Health Signals
                      </p>
                    </div>
                  </div>
                ) : aiStructuredResponse ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Confidence + Status */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">
                          Confidence Score
                        </p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-black tracking-tighter text-gray-900">
                            {aiStructuredResponse.confidence}%
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase ${aiStructuredResponse.confidence > 85 ? "text-emerald-500" : "text-violet-500"}`}
                          >
                            {aiStructuredResponse.confidence > 85
                              ? "High Trust"
                              : "Moderate"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">
                          Status
                        </p>
                        <p
                          className={`text-lg font-black uppercase ${
                            aiStructuredResponse.severity === "high"
                              ? "text-red-600"
                              : aiStructuredResponse.severity === "medium"
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {aiStructuredResponse.severity === "high"
                            ? "Critical"
                            : aiStructuredResponse.severity === "medium"
                              ? "Monitor"
                              : "Healthy"}
                        </p>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${aiStructuredResponse.confidence}%`,
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${aiStructuredResponse.confidence > 85 ? "bg-emerald-500" : "bg-violet-500"}`}
                      />
                    </div>

                    {/* Summary text */}
                    <p className="text-xs text-gray-600 font-medium italic leading-relaxed line-clamp-2 border-l-2 border-violet-200 pl-3">
                      {highlightText(aiStructuredResponse.summary)}
                    </p>

                    {/* Concern + Action */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div
                        className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                          aiStructuredResponse.severity === "high"
                            ? "bg-red-50/60 border-red-100"
                            : aiStructuredResponse.severity === "medium"
                              ? "bg-amber-50/60 border-amber-100"
                              : "bg-violet-50/60 border-violet-100"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <AlertTriangle
                            className={`w-3 h-3 shrink-0 ${aiStructuredResponse.severity === "high" ? "text-red-500" : aiStructuredResponse.severity === "medium" ? "text-amber-500" : "text-violet-500"}`}
                          />
                          <p
                            className={`text-[9px] font-black uppercase tracking-widest ${aiStructuredResponse.severity === "high" ? "text-red-400" : aiStructuredResponse.severity === "medium" ? "text-amber-400" : "text-violet-400"}`}
                          >
                            Key Concern
                          </p>
                        </div>
                        <p className="text-[11px] font-bold text-gray-800 leading-snug line-clamp-3">
                          {highlightText(aiStructuredResponse.concern)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-blue-500 shrink-0" />
                          <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">
                            Action
                          </p>
                        </div>
                        <p className="text-[11px] font-bold text-blue-900 leading-snug line-clamp-3">
                          {highlightText(aiStructuredResponse.action)}
                        </p>
                      </div>
                    </div>

                    {/* Signal bars */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                        Health Signal Breakdown
                      </p>
                      {[
                        {
                          label: "Heart Rate",
                          status:
                            summaryMetrics.avgHeartRate > 90
                              ? "worsening"
                              : "improving",
                          weight: summaryMetrics.avgHeartRate > 90 ? 72 : 88,
                        },
                        {
                          label: "Sleep Quality",
                          status:
                            latestLogs.sleep >= 7 ? "improving" : "worsening",
                          weight: latestLogs.sleep >= 7 ? 90 : 55,
                        },
                        {
                          label: "Hydration",
                          status:
                            latestLogs.water >= 2 ? "improving" : "worsening",
                          weight: latestLogs.water >= 2 ? 85 : 50,
                        },
                      ].map((f, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-600">
                              {f.label}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase ${f.status === "improving" ? "text-emerald-500" : "text-red-500"}`}
                            >
                              {f.status}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${f.weight}%` }}
                              transition={{
                                duration: 0.8,
                                delay: i * 0.1,
                                ease: "easeOut",
                              }}
                              className={`h-full rounded-full ${f.status === "improving" ? "bg-emerald-500" : "bg-red-500"}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                        <span>{chartData.length} data pts</span>
                        <span className="w-px h-3 bg-gray-200" />
                        <span>
                          {lastAnalyzed
                            ? formatDistanceToNow(lastAnalyzed, {
                                addSuffix: true,
                              })
                            : "Never analyzed"}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                        className="text-[9px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-1 hover:gap-1.5 transition-all"
                      >
                        {isSummaryExpanded ? "Hide" : "Details"}{" "}
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <AnimatePresence>
                      {isSummaryExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {[
                              {
                                label: "Heart Rate",
                                status:
                                  summaryMetrics.avgHeartRate > 90
                                    ? "Elevated"
                                    : "Normal",
                                ok: summaryMetrics.avgHeartRate <= 90,
                              },
                              {
                                label: "Sleep",
                                status:
                                  latestLogs.sleep >= 7 ? "Optimal" : "Low",
                                ok: latestLogs.sleep >= 7,
                              },
                              {
                                label: "Hydration",
                                status: latestLogs.water >= 2 ? "Good" : "Low",
                                ok: latestLogs.water >= 2,
                              },
                            ].map((f) => (
                              <div
                                key={f.label}
                                className={`p-2.5 rounded-xl border text-center ${f.ok ? "bg-emerald-50/60 border-emerald-100" : "bg-red-50/60 border-red-100"}`}
                              >
                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                                  {f.label}
                                </p>
                                <p
                                  className={`text-xs font-black mt-0.5 ${f.ok ? "text-emerald-600" : "text-red-600"}`}
                                >
                                  {f.status}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-4 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/40">
                    <div
                      className="relative cursor-pointer"
                      onClick={handleGenerateSummary}
                    >
                      <div className="absolute inset-0 bg-violet-500/15 rounded-2xl blur-xl" />
                      <div className="relative p-5 rounded-2xl bg-white shadow-lg border border-gray-50 hover:scale-105 transition-all duration-300">
                        <Brain className="w-10 h-10 text-violet-600" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-violet-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900">
                        Ready for Health Synthesis
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mt-1 max-w-[200px] mx-auto leading-relaxed">
                        Synthesize your vitals, sleep and mood into a clinical
                        picture.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      className="px-6 py-2.5 bg-violet-600 text-white text-xs font-black rounded-xl hover:bg-violet-700 shadow-lg transition-all active:scale-95"
                    >
                      Start Health Analysis
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── AI HEALTH FORECASTER ─────────────────────────────── */}
            <div className="card p-0 border-2 border-gray-100 bg-white shadow-lg hover:shadow-xl transition-all duration-500 relative overflow-hidden group">
              <div
                className={`absolute inset-0 opacity-[0.04] pointer-events-none bg-gradient-to-br ${
                  aiRiskData &&
                  aiRiskData.confidence &&
                  aiRiskData.confidence < 80
                    ? "from-red-600 via-orange-500 to-transparent"
                    : "from-blue-600 via-emerald-500 to-transparent"
                }`}
              />
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-[0.05] pointer-events-none bg-blue-500" />

              <div className="p-5 relative z-10 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl shadow-sm transition-all duration-700 ${
                        loadingRiskPrediction
                          ? "bg-blue-600 text-white animate-bounce"
                          : aiRiskData &&
                              aiRiskData.confidence &&
                              aiRiskData.confidence < 80
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-black text-gray-900 tracking-tight">
                          AI Health Forecaster
                        </h2>
                        {aiRiskData && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100 animate-pulse">
                            <Activity className="w-2.5 h-2.5" /> Live
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          Predictive Intelligence
                        </p>
                        <div className="h-1 w-1 rounded-full bg-gray-300" />
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">
                          48H Horizon
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handlePredictRisk}
                    disabled={loadingRiskPrediction}
                    className={`relative group/btn px-4 py-2 rounded-xl font-black text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 overflow-hidden uppercase tracking-wide ${
                      loadingRiskPrediction
                        ? "bg-gray-100 text-gray-400"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                    {loadingRiskPrediction ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 relative z-10 group-hover/btn:rotate-12 transition-transform" />
                    )}
                    <span className="relative z-10">
                      {loadingRiskPrediction
                        ? "Calculating..."
                        : "Run Forecast"}
                    </span>
                  </button>
                </div>

                {/* Body */}
                {loadingRiskPrediction ? (
                  <div className="flex flex-col items-center justify-center py-10 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/40 gap-4">
                    <div className="relative">
                      <motion.div
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.2, 0.5, 0.2],
                        }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="absolute inset-0 bg-blue-500 rounded-full blur-2xl"
                      />
                      <div className="relative w-14 h-14 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin shadow-lg" />
                      <Brain className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-blue-600 animate-pulse">
                        {riskThinkingMessage}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Processing Neural Patterns
                      </p>
                    </div>
                  </div>
                ) : aiRiskData ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Confidence + Outlook */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">
                          Confidence Index
                        </p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-black tracking-tighter text-gray-900">
                            {aiRiskData.confidence}%
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase ${aiRiskData.confidence && aiRiskData.confidence > 85 ? "text-emerald-500" : "text-blue-500"}`}
                          >
                            {aiRiskData.confidence && aiRiskData.confidence > 85
                              ? "High Trust"
                              : "Moderate"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">
                          Risk Outlook
                        </p>
                        <p
                          className={`text-lg font-black uppercase tracking-tight ${aiRiskData.confidence && aiRiskData.confidence < 80 ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {aiRiskData.outlook}
                        </p>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="h-[140px] w-full bg-gray-50/50 rounded-2xl p-3 border border-gray-100 relative">
                      <div className="absolute top-2.5 right-3 flex items-center gap-3 z-20">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-0.5 rounded-full bg-blue-500" />
                          <span className="text-[8px] font-black text-gray-400 uppercase">
                            Actual
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-0.5 rounded-full bg-blue-300"
                            style={{ borderTop: "1px dashed #93c5fd" }}
                          />
                          <span className="text-[8px] font-black text-gray-400 uppercase">
                            Predicted
                          </span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={riskTrajectoryData}>
                          <defs>
                            <linearGradient
                              id="riskGradientForecast"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.15}
                              />
                              <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div className="bg-white/95 backdrop-blur-xl p-3 border border-gray-100 shadow-xl rounded-xl min-w-[110px]">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                      {d.time}
                                    </p>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-xl font-black text-gray-900">
                                        {d.predictedRisk || d.risk}%
                                      </span>
                                      <div
                                        className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${d.isFuture ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"}`}
                                      >
                                        {d.isFuture ? "Forecast" : "Actual"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="risk"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fill="url(#riskGradientForecast)"
                            dot={false}
                            activeDot={{
                              r: 5,
                              strokeWidth: 0,
                              fill: "#3b82f6",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="predictedRisk"
                            stroke="#93c5fd"
                            strokeWidth={2}
                            strokeDasharray="6 6"
                            fill="none"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Impact factors */}
                    <div className="space-y-2">
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                        Risk Breakdown Impact
                      </p>
                      {aiRiskData.impactFactors?.map((f, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-600">
                              {f.factor}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase ${f.status === "worsening" ? "text-red-500" : "text-emerald-500"}`}
                            >
                              {f.status}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${f.weight}%` }}
                              className={`h-full ${f.status === "worsening" ? "bg-red-500" : "bg-emerald-500"}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reason + Strategy */}
                    <div className="space-y-2">
                      <p className="text-sm font-black text-gray-900 leading-snug line-clamp-2">
                        {aiRiskData.reason}
                      </p>
                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-white shadow-sm text-blue-600 shrink-0 mt-0.5">
                          <Lightbulb className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">
                            AI Strategy
                          </p>
                          <p className="text-[11px] text-blue-900 font-bold leading-relaxed mt-0.5 line-clamp-2">
                            {aiRiskData.prevention}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Predicted Events */}
                    {aiRiskData.predictedEvents &&
                      aiRiskData.predictedEvents.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                            High-Probability Forecasts
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {aiRiskData.predictedEvents.map((e, i) => (
                              <div
                                key={i}
                                className="p-3 rounded-xl bg-white border-2 border-gray-50 hover:border-blue-100 hover:shadow-md transition-all"
                              >
                                <div className="flex justify-between items-start mb-1.5">
                                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                                    {e.time}
                                  </span>
                                  <div
                                    className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase ${e.impact === "high" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
                                  >
                                    {e.impact}
                                  </div>
                                </div>
                                <h4 className="text-[11px] font-black text-gray-900 mb-1.5 leading-snug">
                                  {e.event}
                                </h4>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500"
                                      style={{ width: `${e.probability}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-black text-blue-600">
                                    {e.probability}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Actions */}
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                          Preventive Actions
                        </p>
                        <button
                          onClick={() => setIsFullActionPlanOpen(true)}
                          className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:gap-1.5 transition-all"
                        >
                          Full Plan <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Deep Rest", icon: Moon },
                          { label: "Hydrate+", icon: Droplets },
                          { label: "Zen Mode", icon: Wind },
                          { label: "Doctor SOS", icon: ShieldAlert },
                        ].map((action) => (
                          <button
                            key={action.label}
                            onClick={() => {
                              setRiskActionFeedback(action.label);
                              setTimeout(
                                () => setRiskActionFeedback(null),
                                3000,
                              );
                            }}
                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                              riskActionFeedback === action.label
                                ? "bg-blue-600 border-blue-600 text-white scale-105 shadow-lg"
                                : "bg-white border-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-600"
                            }`}
                          >
                            <action.icon
                              className={`w-4 h-4 ${riskActionFeedback === action.label ? "text-white" : "text-gray-400"}`}
                            />
                            <span className="text-[8px] font-black uppercase text-center leading-tight">
                              {action.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-4 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/40">
                    <div
                      className="relative cursor-pointer"
                      onClick={handlePredictRisk}
                    >
                      <div className="absolute inset-0 bg-blue-500/15 rounded-2xl blur-xl" />
                      <div className="relative p-5 rounded-2xl bg-white shadow-lg border border-gray-50 hover:scale-105 transition-all duration-300">
                        <ShieldCheck className="w-10 h-10 text-blue-600" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900">
                        Health Forecaster Ready
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mt-1 max-w-[200px] mx-auto leading-relaxed">
                        AI predictions from 24h of physiological patterns to
                        forecast your health trajectory.
                      </p>
                    </div>
                    <button
                      onClick={handlePredictRisk}
                      className="px-6 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 shadow-lg transition-all active:scale-95"
                    >
                      Start Predictive Engine
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {dynamicSummaryCards.map((c) => {
              const meta = metricMetadata[c.id];
              const isMetricExpanded = expandedMetric === c.id;
              const isFocused = focusedMetric === c.id;
              const otherFocused = focusedMetric && focusedMetric !== c.id;

              return (
                <motion.div
                  key={c.id}
                  layout
                  onClick={() =>
                    setExpandedMetric(isMetricExpanded ? null : c.id)
                  }
                  onMouseEnter={() => setFocusMetric(c.id)}
                  onMouseLeave={() => setFocusMetric(null)}
                  className={`card p-5 border cursor-pointer transition-all duration-300 relative overflow-hidden ${c.border} ${c.bg} ${
                    otherFocused
                      ? "opacity-40 scale-[0.98] blur-[0.5px]"
                      : "opacity-100 scale-100"
                  } ${isMetricExpanded ? "ring-2 ring-offset-2 ring-blue-100" : "hover:-translate-y-1 shadow-sm hover:shadow-md"}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {c.label}
                    </p>
                    {meta && (
                      <div
                        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/60 ${
                          meta.trend === "up"
                            ? "text-red-600"
                            : meta.trend === "down"
                              ? "text-emerald-600"
                              : "text-blue-600"
                        }`}
                      >
                        {meta.trend === "up"
                          ? "↑"
                          : meta.trend === "down"
                            ? "↓"
                            : "→"}
                        {meta.trendValue}
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span
                      className={`text-3xl font-black tabular-nums tracking-tight ${c.color}`}
                    >
                      {c.value}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {c.unit}
                    </span>
                  </div>

                  {/* Mini Progress Bar */}
                  <div className="w-full h-1 bg-white/50 rounded-full overflow-hidden mb-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, (Number(c.value) / (c.id === "risk" ? 100 : c.id === "hr" ? 180 : 20)) * 100)}%`,
                      }}
                      className={`h-full ${c.accent} opacity-60`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-gray-500">
                      {meta?.context}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[9px] text-gray-400 font-medium">
                        Updated{" "}
                        {meta?.updatedAt
                          ? formatDistanceToNow(new Date(meta.updatedAt), {
                              addSuffix: true,
                            })
                          : "N/A"}
                      </p>
                      <p className="text-[9px] text-gray-400 font-medium">
                        {meta?.readings} readings
                      </p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isMetricExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-white/40 overflow-hidden"
                      >
                        <p className="text-xs font-semibold text-gray-700 leading-relaxed italic">
                          {meta?.explanation}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Focus/Expand Hint */}
                  {!isMetricExpanded && (
                    <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] font-bold text-gray-300 uppercase">
                        Click to expand
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Main trend chart */}
          <div className="card p-6 border border-gray-100 bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shadow-sm">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">
                    Multi-Vital Trend Overlay
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      chartTrendLabel === "Stable"
                        ? "bg-emerald-50 text-emerald-600"
                        : chartTrendLabel === "Increasing risk"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {chartTrendLabel}
                  </span>
                  <p className="text-[11px] text-gray-500 font-bold italic">
                    {chartTrendLabel === "Stable"
                      ? "Vitals remain stable with slight fluctuations"
                      : chartTrendLabel === "Increasing risk"
                        ? "Recent data suggests an upward risk trend"
                        : "Vitals are currently trending towards a lower risk state"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "hr", label: "Heart Rate", color: "#3b82f6" },
                  { id: "bp", label: "Blood Pressure", color: "#8b5cf6" },
                  { id: "spo2", label: "SpO2", color: "#10b981" },
                  { id: "temp", label: "Temperature", color: "#f59e0b" },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() =>
                      setVisibleVitals((prev) => ({
                        ...prev,
                        [v.id]: !prev[v.id as keyof typeof visibleVitals],
                      }))
                    }
                    onMouseEnter={() => setHoveredVital(v.id)}
                    onMouseLeave={() => setHoveredVital(null)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                      visibleVitals[v.id as keyof typeof visibleVitals]
                        ? "bg-white border-gray-200 shadow-sm scale-100 ring-2 ring-offset-1 ring-gray-50"
                        : "bg-gray-50 border-transparent opacity-40 grayscale scale-95"
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                      style={{ backgroundColor: v.color }}
                    />
                    <span className="text-[10px] font-black text-gray-700 tracking-tight">
                      {v.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[280px] w-full">
              {loading && chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Loading vitals...
                  </p>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F9FAFB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      dx={-5}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: "#F3F4F6", strokeWidth: 2 }}
                    />

                    {visibleVitals.hr && (
                      <Line
                        type="monotone"
                        dataKey="hr"
                        stroke="#3b82f6"
                        strokeWidth={hoveredVital === "hr" ? 3 : 1.5}
                        strokeOpacity={
                          !hoveredVital || hoveredVital === "hr" ? 1 : 0.15
                        }
                        dot={(props) => renderAbnormalDot(props, "hr")}
                        name="Heart Rate"
                        animationDuration={1500}
                        connectNulls={true}
                      />
                    )}
                    {visibleVitals.bp && (
                      <Line
                        type="monotone"
                        dataKey="bp"
                        stroke="#8b5cf6"
                        strokeWidth={hoveredVital === "bp" ? 3 : 1.5}
                        strokeOpacity={
                          !hoveredVital || hoveredVital === "bp" ? 1 : 0.15
                        }
                        dot={(props) => renderAbnormalDot(props, "systolic")}
                        name="Blood Pressure"
                        animationDuration={1500}
                        connectNulls={true}
                      />
                    )}
                    {visibleVitals.spo2 && (
                      <Line
                        type="monotone"
                        dataKey="spo2"
                        stroke="#10b981"
                        strokeWidth={hoveredVital === "spo2" ? 3 : 1.5}
                        strokeOpacity={
                          !hoveredVital || hoveredVital === "spo2" ? 1 : 0.15
                        }
                        dot={(props) => renderAbnormalDot(props, "spo2")}
                        name="SpO2"
                        animationDuration={1500}
                        connectNulls={true}
                      />
                    )}
                    {visibleVitals.temp && (
                      <Line
                        type="monotone"
                        dataKey="temp"
                        stroke="#f59e0b"
                        strokeWidth={hoveredVital === "temp" ? 3 : 1.5}
                        strokeOpacity={
                          !hoveredVital || hoveredVital === "temp" ? 1 : 0.15
                        }
                        dot={(props) => renderAbnormalDot(props, "temp")}
                        name="Temperature"
                        animationDuration={1500}
                        connectNulls={true}
                      />
                    )}

                    {/* Event Annotations */}
                    {eventAnnotations.map((anno, idx) => (
                      <ReferenceLine
                        key={idx}
                        x={chartData[anno.index]?.time}
                        stroke={anno.color}
                        strokeDasharray="3 3"
                        label={{
                          value: anno.label,
                          position: "top",
                          fill: anno.color,
                          fontSize: 9,
                          fontWeight: "bold",
                          className:
                            "bg-white px-2 py-1 rounded-md shadow-sm border border-gray-50",
                        }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 space-y-3">
                  <Activity className="w-10 h-10 text-gray-300" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                      No vitals recorded yet
                    </p>
                    <p className="text-xs text-gray-400 font-medium">
                      Trends will appear here once you log health data.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Correlation panel */}
            <div className="card p-6 border border-gray-100 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden relative group h-fit">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shadow-sm">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">
                    Risk Factor Correlations
                  </h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Statistical Insight Layer
                  </p>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 font-medium leading-relaxed">
                {sortedCorrelations.summaryLine}
              </p>

              <div className="mt-6 space-y-6">
                {sortedCorrelations.items.map((c) => {
                  const isSelected = selectedCorrelation === c.factor;
                  const isCorrelationExpanded =
                    expandedCorrelation === c.factor;
                  const hasSelection = Boolean(selectedCorrelation);
                  const dimOthers = hasSelection && !isSelected;
                  const isPrimary = c.role === "Primary Driver";

                  return (
                    <div
                      key={c.factor}
                      className={`space-y-2 transition-all duration-300 ${
                        dimOthers ? "opacity-40 blur-[0.5px]" : "opacity-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCorrelation((prev) =>
                            prev === c.factor ? null : c.factor,
                          );
                          setExpandedCorrelation((prev) =>
                            prev === c.factor ? null : c.factor,
                          );
                        }}
                        className={`w-full text-left rounded-2xl transition-all duration-300 ${
                          isSelected
                            ? "ring-2 ring-blue-100 bg-blue-50/40 px-3 py-3 -mx-3"
                            : "hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={`text-gray-900 ${isPrimary ? "font-black" : "font-bold"}`}
                            >
                              {c.factor}
                            </span>
                            <span
                              className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-2 ${
                                c.role === "Primary Driver"
                                  ? "bg-red-50 text-red-600 border-red-100"
                                  : c.role === "Contributing Factor"
                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                              }`}
                            >
                              {c.role}
                            </span>
                          </div>

                          <span
                            className={`font-black ${c.indicator.color} flex items-center gap-3`}
                          >
                            <div
                              className="flex items-center gap-1.5"
                              title="Compared to last 24h"
                            >
                              <span className="tabular-nums text-[10px]">
                                {c.trend === "up"
                                  ? "↑"
                                  : c.trend === "down"
                                    ? "↓"
                                    : "→"}
                              </span>
                              <span className="tabular-nums text-sm">
                                {Math.round(c.percent)}%
                              </span>
                            </div>
                            <div
                              className={`p-1 rounded-md bg-gray-100 transition-transform ${isCorrelationExpanded ? "rotate-180" : ""}`}
                            >
                              <ArrowDownRight className="w-3 h-3" />
                            </div>
                          </span>
                        </div>

                        <div
                          className={`mt-2 ${isPrimary ? "h-2 bg-red-100/50" : "h-1.5 bg-gray-100"} rounded-full overflow-hidden`}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(5, Math.min(100, c.percent))}%`,
                            }}
                            className={`h-full rounded-full transition-all duration-500 ${c.indicator.bg}`}
                          />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isCorrelationExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div
                              className={`mt-2 p-4 rounded-2xl border-2 ${
                                isPrimary
                                  ? "bg-red-50/30 border-red-50"
                                  : "bg-gray-50/30 border-gray-50"
                              }`}
                            >
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                Correlation Analysis
                              </p>
                              <p className="text-xs text-gray-700 font-bold leading-relaxed">
                                {c.explanation}
                              </p>
                              <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl bg-white/80 border border-gray-100 shadow-sm">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    Impact
                                  </p>
                                  <p className="text-xs font-black text-gray-900 mt-1">
                                    {c.impactLevel}
                                  </p>
                                </div>
                                <div className="p-3 rounded-xl bg-white/80 border border-gray-100 shadow-sm">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    Trend
                                  </p>
                                  <p className="text-xs font-black text-gray-900 mt-1">
                                    {c.trendLabel}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-600 font-black leading-relaxed italic">
                  {sortedCorrelations.focusLine}
                </p>
              </div>
            </div>

            {/* AI Insights + Anomalies */}
            <div className="card p-6 border border-gray-100 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 h-fit">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shadow-sm">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight">
                    Anomaly Detection
                  </h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Real-time Pattern Monitoring
                  </p>
                </div>
              </div>

              {anomalyUi.summaryLine &&
                !loadingSummary &&
                anomalyUi.grouped.length > 0 && (
                  <div className="mb-6 p-4 rounded-2xl border-2 border-blue-50 bg-blue-50/30 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-white border border-blue-100 text-blue-600 shadow-sm flex-shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                          System insight
                        </p>
                        <p className="text-sm font-bold text-gray-800 leading-relaxed mt-0.5">
                          {anomalyUi.summaryLine}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="space-y-3 mb-4">
                {loadingAnomalies ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-3 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                    <p className="text-xs font-medium text-gray-500">
                      Analyzing anomalies...
                    </p>
                  </div>
                ) : anomalyUi.grouped.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Today
                      </p>
                      {anomalyUi.hasEarlier && (
                        <p className="text-[10px] font-bold text-gray-400">
                          Showing most recent day
                        </p>
                      )}
                    </div>

                    {anomalyUi.grouped.map((group) => {
                      const isExpanded = expandedAnomaly === group.key;
                      const sev = group.severity;

                      const leftBorder =
                        sev === "high"
                          ? "border-l-red-500"
                          : sev === "moderate"
                            ? "border-l-yellow-400"
                            : "border-l-emerald-500";
                      const softBg =
                        sev === "high"
                          ? "bg-red-50/50"
                          : sev === "moderate"
                            ? "bg-yellow-50/50"
                            : "bg-emerald-50/40";
                      const badge =
                        sev === "high"
                          ? {
                              text: "text-red-700",
                              badge: "bg-red-100 text-red-700 border-red-200",
                            }
                          : sev === "moderate"
                            ? {
                                text: "text-yellow-800",
                                badge:
                                  "bg-yellow-100 text-yellow-800 border-yellow-200",
                              }
                            : {
                                text: "text-emerald-700",
                                badge:
                                  "bg-emerald-100 text-emerald-700 border-emerald-200",
                              };

                      const countText =
                        group.items.length > 1
                          ? `(${group.items.length} times)`
                          : "";
                      const timeText = group.latestAt
                        ? format(group.latestAt, "HH:mm")
                        : "—";

                      return (
                        <motion.div
                          key={group.key}
                          layout
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className={`rounded-2xl border border-gray-100 ${softBg} shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] overflow-hidden`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAnomaly((prev) =>
                                prev === group.key ? null : group.key,
                              )
                            }
                            className={`w-full text-left p-4 border-l-2 ${leftBorder} transition-all duration-200`}
                            aria-expanded={isExpanded}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-sm font-bold ${badge.text}`}
                                  >
                                    {group.label} {countText}
                                  </span>
                                  <span
                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${badge.badge}`}
                                  >
                                    {sev}
                                  </span>
                                </div>

                                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600 font-medium">
                                  <span className="truncate">
                                    {group.latestValue !== null &&
                                    group.latestValue !== undefined
                                      ? `Value: ${group.latestValue}`
                                      : "Value: —"}
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  <span className="whitespace-nowrap">
                                    {timeText}
                                  </span>
                                </div>
                              </div>

                              <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap pt-0.5">
                                {isExpanded ? "Hide" : "Details"}
                              </span>
                            </div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  duration: 0.22,
                                  ease: "easeInOut",
                                }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4">
                                  <div className="p-4 rounded-2xl bg-white/70 border border-white/80 shadow-inner">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Timestamp
                                        </p>
                                        <p className="text-xs font-semibold text-gray-900 mt-1">
                                          {group.latestAt
                                            ? format(
                                                group.latestAt,
                                                "MMM d, yyyy • HH:mm",
                                              )
                                            : "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                          Value
                                        </p>
                                        <p className="text-xs font-semibold text-gray-900 mt-1">
                                          {group.latestValue !== null &&
                                          group.latestValue !== undefined
                                            ? String(group.latestValue)
                                            : "—"}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-4">
                                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Explanation
                                      </p>
                                      <p className="text-xs text-gray-700 font-medium leading-relaxed mt-1">
                                        {group.explanation}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                    <div className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm mb-3">
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      All vitals are stable
                    </p>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      No unusual patterns detected.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Full Action Plan Modal */}
      <AnimatePresence>
        {isFullActionPlanOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFullActionPlanOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                      Clinical Action Plan
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        AI Personalized
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        • Based on 48H Forecast
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsFullActionPlanOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Immediate Intervention */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-50 text-red-600">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                        Phase 1: Immediate
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        {
                          title: "Physical Decompression",
                          desc: "Lie on your left side for 20 mins to optimize blood flow.",
                          icon: Moon,
                        },
                        {
                          title: "Rapid Hydration Protocol",
                          desc: "Consume 500ml of water with electrolytes immediately.",
                          icon: Droplets,
                        },
                        {
                          title: "Re-check Vitals",
                          desc: "Measure BP and Heart Rate in exactly 30 minutes.",
                          icon: Activity,
                        },
                      ].map((step, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-gray-50 border border-gray-100 group hover:bg-white hover:shadow-md transition-all duration-300"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 group-hover:text-blue-500 transition-colors">
                              <step.icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-gray-900 leading-tight">
                                {step.title}
                              </p>
                              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Short-term Stabilization */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                        Phase 2: Next 12-24H
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        {
                          title: "Salt & Caffeine Audit",
                          desc: "Reduce sodium intake and avoid caffeine for the next 24h.",
                          icon: Info,
                        },
                        {
                          title: "Stress Mitigation",
                          desc: "Practice 10 mins of guided box breathing every 4 hours.",
                          icon: Wind,
                        },
                        {
                          title: "Activity Adjustment",
                          desc: "Limit physical exertion to light walking or rest only.",
                          icon: Heart,
                        },
                      ].map((step, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-gray-50 border border-gray-100 group hover:bg-white hover:shadow-md transition-all duration-300"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 group-hover:text-blue-500 transition-colors">
                              <step.icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-gray-900 leading-tight">
                                {step.title}
                              </p>
                              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Medical Protocol */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                        Medical Protocol
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div className="p-5 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-100 space-y-4">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-blue-200" />
                          <p className="text-xs font-black uppercase tracking-widest">
                            Doctor Note
                          </p>
                        </div>
                        <p className="text-sm font-bold leading-relaxed">
                          If BP remains {">"}140/90 or SpO2 stays {"<"}95% after
                          2 hours of rest, contact your primary care physician
                          immediately.
                        </p>
                        <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-colors">
                          Notify Care Team
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                          Red Flags to Watch For:
                        </p>
                        <ul className="space-y-2">
                          {[
                            "Severe headache",
                            "Vision changes",
                            "Upper abdominal pain",
                            "Shortness of breath",
                          ].map((flag, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 text-[11px] font-black text-gray-600"
                            >
                              <div className="w-1 h-1 rounded-full bg-red-400" />
                              {flag}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 font-bold italic max-w-[60%] leading-relaxed">
                  Disclaimer: This AI-generated action plan is for informational
                  purposes only and does not replace professional medical
                  advice. Always consult your doctor for serious health
                  concerns.
                </p>
                <button
                  onClick={() => setIsFullActionPlanOpen(false)}
                  className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
                >
                  Close Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
