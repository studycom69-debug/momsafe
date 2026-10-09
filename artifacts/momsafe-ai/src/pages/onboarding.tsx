import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  Heart,
  User,
  Calendar,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Activity,
  AlertCircle,
  Check,
  Lock,
  Baby,
  Utensils,
  ShieldAlert,
  Phone,
  HelpCircle,
  LogOut,
  FileText,
  Zap,
  Info,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
} from "lucide-react";

function validateName(name: string): string | null {
  const v = name.trim();
  if (!v) return "Please enter your full name";
  if (v.length < 2) return "Name must be at least 2 characters";
  if (v.length > 80) return "Name must be under 80 characters";
  if (/\d/.test(v)) return "Name should not contain numbers";
  const bad = /(.)\1{3,}/;
  if (bad.test(v)) return "Name looks invalid (too many repeated characters)";
  const re = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-\s.]{1,79}$/;
  if (!re.test(v)) return "Please enter a proper real name (letters only)";
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "Please enter your full name (first and last)";
  const banned = /^(xyz|abc|test|user|demo|qwe|asd|poop|fuck|shit|123|none|null|fake)$/i;
  for (const w of words) if (banned.test(w.replace(/[^a-z]/gi, ""))) return "Please enter a proper name";
  return null;
}

function validateAge(age: string): string | null {
  if (!age) return null;
  const n = Number(age);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Age must be a whole number";
  if (n < 15) return "Age must be at least 15";
  if (n > 55) return "Age must be 55 or under";
  return null;
}

function validateWeek(w: string): string | null {
  if (!w) return null;
  const n = Number(w);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Week must be a whole number";
  if (n < 1 || n > 42) return "Week must be between 1 and 42";
  return null;
}

function validateDueDate(d: string): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "Please select a valid date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = new Date(today);
  min.setDate(min.getDate() - 294);
  const max = new Date(today);
  max.setDate(max.getDate() + 294);
  if (dt < min) return "Due date cannot be more than 42 weeks ago";
  if (dt > max) return "Due date cannot be more than 42 weeks ahead";
  return null;
}

function formatClinicalNotes(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  const replacements: [RegExp, string][] = [
    [/\bbp\b/gi, "blood pressure"],
    [/\bgd\b/gi, "gestational diabetes"],
    [/\bhg\b/gi, "severe nausea (hyperemesis)"],
    [/\bhb\b/gi, "hemoglobin/iron levels"],
    [/\bc[-\s]?sec\b|\bcsection\b/gi, "previous Caesarean delivery"],
    [/\bpuking\b|\bvomit(ing)?\b/gi, "nausea and vomiting"],
    [/\bdizzy\b/gi, "dizziness"],
    [/\bfaint(ing)?\b/gi, "lightheadedness"],
    [/\bsugar spike(s)?\b/gi, "elevated post-meal blood sugar"],
    [/\btired(ness)?\b/gi, "fatigue"],
    [/\bswelling\b/gi, "swelling in extremities"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  if (!/[.!?]$/.test(text)) text += ".";

  return `Patient notes: ${text}`;
}

const CONDITION_OPTIONS = [
  "Gestational Diabetes",
  "Pre-eclampsia History",
  "Chronic Hypertension",
  "Thyroid Condition",
  "Gestational Anemia",
  "PCOS",
  "Asthma",
  "None of the above",
];

const ALLERGY_OPTIONS = [
  "Penicillin & Antibiotics",
  "Sulfa Drugs",
  "Latex",
  "Peanuts & Tree Nuts",
  "Dairy / Lactose",
  "Gluten / Wheat",
  "Shellfish & Seafood",
  "No Known Allergies",
];

const DIETARY_PLANS = [
  {
    id: "diabetic",
    title: "Diabetic & Glycemic Friendly",
    desc: "Low-glycemic load index optimization & continuous glucose calibration",
    badge: "Metabolic Support",
  },
  {
    id: "mediterranean",
    title: "Mediterranean Baseline",
    desc: "Heart-healthy polyphenol, olive oil, and lipid balance guidelines",
    badge: "Cardiovascular",
  },
  {
    id: "plant",
    title: "Plant-Forward / Prenatal Vegan",
    desc: "High-bioavailability iron, B12, and plant-based protein tracking",
    badge: "Nutritional Micronutrients",
  },
  {
    id: "standard",
    title: "Standard Balanced Prenatal",
    desc: "American College of Obstetricians & Gynecologists (ACOG) standard recommendations",
    badge: "ACOG Standard",
  },
];

interface OnboardingProps {
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps = {}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [originalNotes, setOriginalNotes] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [lastSavedTime, setLastSavedTime] = useState<string>("Just now");
  const [activeModal, setActiveModal] = useState<"hipaa" | "acog" | "sos" | "help" | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    age: "",
    gestational_week: "",
    due_date: "",
    doctor_name: "",
    emergency_contact: "",
    dietary_preference: "diabetic",
    notes: "",
    enable_telemetry: true,
  });

  const [selectedConditions, setSelectedConditions] = useState<string[]>(["Gestational Diabetes"]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(["Penicillin & Antibiotics"]);

  const errors = {
    full_name: validateName(form.full_name),
    age: validateAge(form.age),
    gestational_week: validateWeek(form.gestational_week),
    due_date: validateDueDate(form.due_date),
  };

  // If user already has a completed profile, redirect to dashboard
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("full_name, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.onboarding_completed && data?.full_name) {
        if (onComplete) onComplete();
        window.location.href = "/dashboard";
      } else if (data?.full_name && !form.full_name) {
        setForm((f) => ({ ...f, full_name: data.full_name }));
      }
    })();
  }, [user, onComplete]);

  // Set mock last saved time
  useEffect(() => {
    const timer = setInterval(() => {
      setLastSavedTime("1m ago");
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-calculate due date from gestational week
  useEffect(() => {
    const week = Number(form.gestational_week);
    if (week >= 1 && week <= 42 && !form.due_date) {
      const remaining = 40 - week;
      const due = new Date(Date.now() + remaining * 7 * 24 * 60 * 60 * 1000);
      setForm((f) => ({ ...f, due_date: due.toISOString().split("T")[0] }));
    }
  }, [form.gestational_week]);

  // Auto-calculate gestational week from due date
  useEffect(() => {
    if (!form.due_date) return;
    const due = new Date(form.due_date);
    const remaining = Math.round((due.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000));
    const week = Math.max(1, Math.min(42, 40 - remaining));
    setForm((f) => ({ ...f, gestational_week: String(week) }));
  }, [form.due_date]);

  const toggleCondition = (item: string) => {
    if (item === "None of the above") {
      setSelectedConditions(["None of the above"]);
      return;
    }
    const filtered = selectedConditions.filter((x) => x !== "None of the above");
    if (filtered.includes(item)) {
      setSelectedConditions(filtered.filter((x) => x !== item));
    } else {
      setSelectedConditions([...filtered, item]);
    }
  };

  const toggleAllergy = (item: string) => {
    if (item === "No Known Allergies") {
      setSelectedAllergies(["No Known Allergies"]);
      return;
    }
    const filtered = selectedAllergies.filter((x) => x !== "No Known Allergies");
    if (filtered.includes(item)) {
      setSelectedAllergies(filtered.filter((x) => x !== item));
    } else {
      setSelectedAllergies([...filtered, item]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setTouched({ full_name: true, age: true, gestational_week: true, due_date: true });
      if (errors.full_name) {
        toast.error(errors.full_name);
        return;
      }
      if (errors.age || errors.gestational_week || errors.due_date) {
        toast.error("Please correct the highlighted fields before continuing.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleFormatNotes = async () => {
    if (!form.notes.trim()) {
      toast.error("Please enter a short doctor directive or symptom note first.");
      return;
    }
    setIsFormatting(true);
    setOriginalNotes(form.notes);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const polished = formatClinicalNotes(form.notes);
      setForm((f) => ({ ...f, notes: polished }));
      toast.success("Standardized into clinical care notation");
    } catch {
      toast.error("Unable to format notes right now.");
    } finally {
      setIsFormatting(false);
    }
  };

  const handleUndoFormat = () => {
    if (originalNotes !== null) {
      setForm((f) => ({ ...f, notes: originalNotes }));
      setOriginalNotes(null);
      toast.info("Restored original notes");
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Session expired. Please log in again.");
      return;
    }
    setSaving(true);

    try {
      const conditionsStr = selectedConditions.length > 0 ? selectedConditions.join(", ") : null;
      const allergiesStr = selectedAllergies.length > 0 ? selectedAllergies.join(", ") : null;

      const { error } = await supabase.from("users").upsert(
        {
          id: user.id,
          full_name: form.full_name.trim(),
          age: Number(form.age) || null,
          gestational_week: Number(form.gestational_week) || null,
          due_date: form.due_date || null,
          doctor_name: form.doctor_name.trim() || null,
          emergency_contact: form.emergency_contact.trim() || null,
          conditions: conditionsStr,
          allergies: allergiesStr,
          dietary_preference: form.dietary_preference || null,
          notes: form.notes.trim() || null,
          onboarding_completed: true,
        },
        { onConflict: "id" }
      );

      if (error) throw error;

      toast.success("Maternal care baseline saved successfully!");
      if (onComplete) onComplete();
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const weekNum = Number(form.gestational_week) || 24;
  const trimester =
    weekNum >= 28 ? "Trimester 3" : weekNum >= 13 ? "Trimester 2" : "Trimester 1";
  const progressPercent = Math.min(100, Math.max(5, Math.round((weekNum / 40) * 100)));

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-6 sm:py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-between items-center text-slate-800 antialiased selection:bg-teal-100 selection:text-teal-900 font-sans">
      {/* Elevated Container Card (Matches Kastamer Architecture) */}
      <div className="max-w-6xl w-full bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08)] border border-slate-100 overflow-hidden flex flex-col my-auto transition-all">
        {/* Top Navigation Bar inside Container */}
        <header className="px-6 sm:px-8 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0D9488] shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 tracking-tight font-sans">
                MomSafe <span className="text-[#0D9488]">AI</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-100/60 text-[#0D9488] text-[11px] font-semibold tracking-wide uppercase">
                Intake Portal
              </span>
            </div>
          </div>

          {/* Stepper Breadcrumbs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 1
                  ? "bg-teal-50 text-[#0D9488] font-semibold border-b-2 border-[#0D9488]"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  step > 1 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 1 ? "✓" : "1"}
              </span>
              1. Personal & Care Team
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(2);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 2
                  ? "bg-teal-50 text-[#0D9488] font-semibold border-b-2 border-[#0D9488]"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  step > 2 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 2 ? "✓" : "2"}
              </span>
              2. Clinical Context
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(3);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 3
                  ? "bg-teal-50 text-[#0D9488] font-semibold border-b-2 border-[#0D9488]"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  step > 3 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 3 ? "✓" : "3"}
              </span>
              3. Nutrition & Vitals
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(4);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 4
                  ? "bg-teal-50 text-[#0D9488] font-semibold border-b-2 border-[#0D9488]"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  step === 4 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                4
              </span>
              4. Care Activation
            </button>
          </nav>

          {/* Right User Session & Actions */}
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-slate-500 font-medium">
              Signed in as{" "}
              <strong className="text-slate-800 font-semibold">
                {user?.email || "sarah.jenkins@gmail.com"}
              </strong>
            </span>
            <div className="hidden sm:block h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => setActiveModal("help")}
              className="flex items-center gap-1 text-slate-600 hover:text-[#0D9488] transition-colors font-medium px-2 py-1 rounded-md hover:bg-slate-50"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              Help Assistance
            </button>
            <button
              type="button"
              onClick={() => {
                toast.info("Draft intake progress is saved automatically.");
                window.location.href = "/dashboard";
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              Save & Exit
            </button>
          </div>
        </header>

        {/* Split Card Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* LEFT COLUMN: Connected Vertical Timeline Stepper */}
          <aside className="lg:col-span-5 bg-gradient-to-b from-sky-50/70 via-teal-50/30 to-slate-50 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-between relative">
            <div>
              {/* Notice Banner */}
              <div className="p-3.5 rounded-xl bg-white border border-teal-100 shadow-sm flex items-start gap-2.5 mb-8">
                <Info className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Get started by personalizing your maternal care profile. MomSafe AI tailors 24/7 vitals telemetry to your trimester.
                </p>
              </div>

              {/* Vertical Stepper with connected vertical line */}
              <div className="space-y-6 relative pl-2">
                {/* Connecting Line */}
                <div className="absolute left-[23px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-teal-200/80 -z-0" />

                {/* Step 1 Node */}
                <div
                  onClick={() => setStep(1)}
                  className={`flex items-start gap-3.5 cursor-pointer group relative z-10`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 1
                        ? "bg-[#0D9488] text-white shadow-md ring-4 ring-teal-100"
                        : step > 1
                        ? "bg-teal-600 text-white"
                        : "bg-white border-2 border-slate-300 text-slate-500"
                    }`}
                  >
                    {step > 1 ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          step === 1 ? "text-slate-900 font-bold" : "text-slate-700"
                        }`}
                      >
                        Personal & Care Team
                      </span>
                      {step === 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100/70 text-[#0D9488] text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Set up your profile, estimated due date, and emergency guardian.
                    </p>
                  </div>
                </div>

                {/* Step 2 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(2);
                  }}
                  className={`flex items-start gap-3.5 cursor-pointer group relative z-10`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 2
                        ? "bg-[#0D9488] text-white shadow-md ring-4 ring-teal-100"
                        : step > 2
                        ? "bg-teal-600 text-white"
                        : "bg-white border-2 border-slate-300 text-slate-500"
                    }`}
                  >
                    {step > 2 ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          step === 2 ? "text-slate-900 font-bold" : "text-slate-700"
                        }`}
                      >
                        Clinical Risk History
                      </span>
                      {step === 2 && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100/70 text-[#0D9488] text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Share pre-existing conditions and allergies for predictive safety telemetry.
                    </p>
                  </div>
                </div>

                {/* Step 3 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(3);
                  }}
                  className={`flex items-start gap-3.5 cursor-pointer group relative z-10`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 3
                        ? "bg-[#0D9488] text-white shadow-md ring-4 ring-teal-100"
                        : step > 3
                        ? "bg-teal-600 text-white"
                        : "bg-white border-2 border-slate-300 text-slate-500"
                    }`}
                  >
                    {step > 3 ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <Utensils className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          step === 3 ? "text-slate-900 font-bold" : "text-slate-700"
                        }`}
                      >
                        Nutrition & Metabolic Plan
                      </span>
                      {step === 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100/70 text-[#0D9488] text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Configure dietary preferences and glycemic tracking thresholds.
                    </p>
                  </div>
                </div>

                {/* Step 4 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(4);
                  }}
                  className={`flex items-start gap-3.5 cursor-pointer group relative z-10`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 4
                        ? "bg-[#0D9488] text-white shadow-md ring-4 ring-teal-100"
                        : "bg-white border-2 border-slate-300 text-slate-500"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          step === 4 ? "text-slate-900 font-bold" : "text-slate-700"
                        }`}
                      >
                        Care Plan Activation
                      </span>
                      {step === 4 && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100/70 text-[#0D9488] text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Review maternal baseline and connect 24/7 care guardian escalation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Reassurance Card */}
            <div className="mt-8 p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-[#0D9488] shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs leading-tight">
                <p className="font-semibold text-slate-800">
                  Bank-grade 256-bit encryption
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  HIPAA-compliant continuous biometric handling.
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: Focused Progressive Disclosure Form */}
          <main className="lg:col-span-7 p-6 sm:p-10 bg-white flex flex-col justify-between">
            <div>
              {/* Step Header */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0D9488] mb-1.5">
                  STEP {step} OF 4 —{" "}
                  {step === 1 && "Maternal Profile Initialization"}
                  {step === 2 && "Clinical Risk & Vital Thresholds"}
                  {step === 3 && "Nutrition & Metabolic Targets"}
                  {step === 4 && "Baseline Review & Activation"}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {step === 1 && "Tell us about your pregnancy journey"}
                  {step === 2 && "Clinical Conditions & Risk History"}
                  {step === 3 && "Dietary & Metabolic Guidance"}
                  {step === 4 && "Verify & Activate Your Care Plan"}
                </h1>
                <p className="text-sm text-slate-500 mt-1.5 max-w-xl leading-relaxed">
                  {step === 1 &&
                    "Set up your profile to receive proactive health insights and ensure your care team has immediate access to critical vitals during an emergency."}
                  {step === 2 &&
                    "Alerts the predictive engine for early hemodynamic telemetry anomalies, blood pressure spikes, and customized medication monitoring."}
                  {step === 3 &&
                    "Synthesizes glucose response curves and meal absorptive thresholds with continuous wearable health tracking."}
                  {step === 4 &&
                    "Your personal care guardian and 24/7 AI telemetry channels are ready. Confirm your baseline details to complete initialization."}
                </p>
              </div>

              {/* Form Content By Step */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Mother's Legal Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                      Mother's Legal Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
                        placeholder="e.g. Sarah Jenkins"
                        className={`w-full h-11 px-3.5 pl-10 rounded-xl border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] transition-all ${
                          touched.full_name && errors.full_name
                            ? "border-rose-300 bg-rose-50/20"
                            : "border-slate-200"
                        }`}
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                    {touched.full_name && errors.full_name && (
                      <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.full_name}
                      </p>
                    )}
                  </div>

                  {/* Estimated Due Date & Trimester */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Estimated Due Date & Trimester <span className="text-rose-500">*</span>
                      </label>
                      {form.gestational_week && (
                        <span className="text-[11px] font-semibold text-[#0D9488] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                          {trimester} (Week {weekNum}, {progressPercent}% complete)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          type="date"
                          value={form.due_date}
                          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                          className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] transition-all"
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="42"
                          value={form.gestational_week}
                          onChange={(e) => setForm({ ...form, gestational_week: e.target.value })}
                          placeholder="Current Week (e.g. 24)"
                          className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] transition-all"
                        />
                        <Baby className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                      We calculate your gestational weeks automatically and adapt daily safety telemetry.
                    </p>
                  </div>

                  {/* Primary OB/GYN */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                      Primary OB/GYN or Care Provider
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.doctor_name}
                        onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
                        placeholder="e.g. Dr. Aris Thorne, MD — St. Jude Women's Health"
                        className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] transition-all"
                      />
                      <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Emergency Guardian Contact */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                      Emergency Guardian Contact
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.emergency_contact}
                        onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                        placeholder="e.g. Mark Jenkins (Partner) • +1 (555) 382-9912"
                        className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] transition-all"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {/* Pre-existing Conditions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Pre-existing & Gestational Conditions
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">Select all that apply</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CONDITION_OPTIONS.map((item) => {
                        const active = selectedConditions.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleCondition(item)}
                            className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-teal-50 border border-[#0D9488] text-[#0D9488] font-semibold shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                active ? "bg-[#0D9488] text-white" : "border border-slate-300"
                              }`}
                            >
                              {active ? "✓" : ""}
                            </span>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Known Allergies */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Known Allergies & Sensitivities
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">Clinical Triage</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGY_OPTIONS.map((item) => {
                        const active = selectedAllergies.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleAllergy(item)}
                            className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-teal-50 border border-[#0D9488] text-[#0D9488] font-semibold shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                active ? "bg-[#0D9488] text-white" : "border border-slate-300"
                              }`}
                            >
                              {active ? "✓" : ""}
                            </span>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Physician Thresholds / Clinical Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Obstetrician Notes & Directives
                      </label>
                      <div className="flex items-center gap-2">
                        {originalNotes && (
                          <button
                            type="button"
                            onClick={handleUndoFormat}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Undo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleFormatNotes}
                          disabled={isFormatting}
                          className="text-[11px] font-semibold text-[#0D9488] hover:text-teal-700 flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-100"
                        >
                          {isFormatting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Format for Care Team
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="e.g. Patient advised on regular blood pressure monitoring twice daily. Alert team if systolic exceeds 135 mmHg or if fetal kick count falls under 10 over 2 hours."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0D9488] transition-all"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488]" />
                      Automated telemetry sync inherits physician thresholds into alert triggers.
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {DIETARY_PLANS.map((plan) => {
                      const selected = form.dietary_preference === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setForm({ ...form, dietary_preference: plan.id })}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            selected
                              ? "border-[#0D9488] bg-teal-50/40 shadow-sm"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-sm font-bold ${
                                  selected ? "text-slate-900" : "text-slate-800"
                                }`}
                              >
                                {plan.title}
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                                  selected
                                    ? "bg-[#0D9488] border-[#0D9488] text-white"
                                    : "border-slate-300"
                                }`}
                              >
                                {selected && "✓"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mt-1">
                              {plan.desc}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0D9488] mt-3">
                            {plan.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Telemetry Toggle */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between mt-4">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Continuous Metabolic & Nutrition Sync
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Cross-correlate meal logs with continuous glucose monitor (CGM) readings automatically.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={form.enable_telemetry}
                        onChange={(e) =>
                          setForm({ ...form, enable_telemetry: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0D9488]"></div>
                    </label>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  {/* Care Plan Activation Summary Box */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Maternal Profile Summary
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {form.full_name || "Patient Intake"} • {trimester} (Week {weekNum})
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-teal-100/80 text-[#0D9488] text-xs font-bold border border-teal-200">
                        Ready to Initialize
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[11px] block">Estimated Delivery</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">
                          {form.due_date || "Calculated at baseline"}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[11px] block">Care Provider (OB/GYN)</span>
                        <span className="font-bold text-slate-800 mt-0.5 block truncate">
                          {form.doctor_name || "Self-monitored / St. Jude"}
                        </span>
                      </div>
                    </div>

                    {/* Active Protocols List */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                        Activated Safety Protocols:
                      </span>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          24/7 AI Vitals Telemetry Loop
                        </span>
                        <span className="text-[11px] font-semibold text-teal-700">Ready to sync</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Emergency SOS & Guardian Escalation
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">Configured</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation Pills Row */}
              <div className="mt-8 pt-5 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
                  Clinical Standards & Verification:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal("hipaa")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    HIPAA Privacy Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("acog")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    ACOG Clinical Standards
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("sos")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    24/7 Emergency SOS Loop
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400 order-2 sm:order-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Autosaved {lastSavedTime}
                </span>
                {step > 1 && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="text-slate-600 hover:text-slate-900 font-medium underline flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back to Step {step - 1}
                    </button>
                  </>
                )}
              </div>

              <div className="order-1 sm:order-2 w-full sm:w-auto flex items-center gap-3">
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00685F] hover:bg-[#005149] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Save and continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#00685F] hover:bg-[#005149] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Activating Care Baseline...
                      </>
                    ) : (
                      <>
                        <span>Complete Care Setup</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Discreet Bottom Compliance & Trust Footer */}
      <footer className="max-w-6xl w-full mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 px-4">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-bold text-slate-700">MomSafe AI</span>
          <span>•</span>
          <p>© 2026 MomSafe AI Medical Systems Inc. All clinical data protected under HIPAA standards.</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveModal("hipaa")}
            className="hover:text-slate-700 underline transition-colors"
          >
            HIPAA Compliance
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("acog")}
            className="hover:text-slate-700 underline transition-colors"
          >
            SOC2 Type II Certified
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("acog")}
            className="hover:text-slate-700 underline transition-colors"
          >
            Clinical Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("sos")}
            className="hover:text-slate-700 underline transition-colors"
          >
            Terms of Care
          </button>
        </div>
      </footer>

      {/* Trust Badge Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#0D9488]" />
          AES 256-bit End-to-End Encryption
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          HIPAA Certified & Compliant
        </span>
        <span className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          American College of Obstetricians and Gynecologists (ACOG) Aligned
        </span>
      </div>

      {/* Lightweight Accessible Info Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            {activeModal === "hipaa" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  HIPAA Security & Health Data Safeguards
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  MomSafe AI enforces administrative, physical, and technical safeguards pursuant to 45 CFR Part 160 and Part 164. All protected health information (PHI) is encrypted at rest using AES-256 and in transit via TLS 1.3. Your obstetrician records are never sold or shared with advertisers.
                </p>
              </div>
            )}

            {activeModal === "acog" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  ACOG Clinical Standards Alignment
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Our predictive triage parameters conform directly to clinical practice guidelines published by the American College of Obstetricians and Gynecologists (ACOG), including gestational blood pressure ranges (&lt;140/90 mmHg) and glucose tolerance thresholds.
                </p>
              </div>
            )}

            {activeModal === "sos" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  24/7 Emergency SOS & Guardian Escalation
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  In acute biometric anomalies (e.g., severe systolic spike &gt;160 mmHg or abnormal fetal movement deceleration), MomSafe AI triggers an automated emergency loop that dispatches high-priority SMS alerts with GPS coordinates to your registered emergency guardian.
                </p>
              </div>
            )}

            {activeModal === "help" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center mb-3">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Maternal Care Assistance & Support
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Need help completing your clinical setup? Our maternal care navigators are available to assist you.
                </p>
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <p className="font-semibold text-slate-800">Support Hours: 24/7 Priority Care</p>
                  <p className="text-slate-500 mt-0.5">Contact: support@momsafe.health • +1 (800) 412-MOMS</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
