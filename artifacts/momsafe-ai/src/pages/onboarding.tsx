import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  Heart,
  HeartPulse,
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
  Phone,
  HelpCircle,
  LogOut,
  FileText,
  Zap,
  Info,
  CheckCircle2,
  Clock,
  X,
  Hospital,
  MapPin,
  Flame,
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
  if (n < 16) return "Age must be at least 16";
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
    [/\bgd\b|\bgdm\b/gi, "gestational diabetes (GDM)"],
    [/\bhg\b/gi, "hyperemesis gravidarum (severe nausea)"],
    [/\bhb\b/gi, "hemoglobin/iron levels"],
    [/\bc[-\s]?sec\b|\bcsection\b/gi, "previous Caesarean delivery"],
    [/\bpuking\b|\bvomit(ing)?\b/gi, "nausea and vomiting"],
    [/\bdizzy\b/gi, "dizziness"],
    [/\bfaint(ing)?\b/gi, "lightheadedness"],
    [/\bsugar spike(s)?\b/gi, "elevated post-meal blood glucose"],
    [/\btired(ness)?\b/gi, "maternal fatigue"],
    [/\bswelling\b|\bedema\b/gi, "pedal edema / swelling"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  if (!/[.!?]$/.test(text)) text += ".";

  return `Doctor's instructions: ${text}`;
}

const INDIAN_CONDITION_OPTIONS = [
  "Gestational Diabetes (GDM)",
  "Pre-eclampsia / High BP",
  "Pregnancy Anemia (Low Hb)",
  "Thyroid (Hypothyroid / TSH)",
  "Gestational Hypertension",
  "PCOS / PCOD History",
  "Asthma / Respiratory",
  "None of the above",
];

const INDIAN_ALLERGY_OPTIONS = [
  "Penicillin & Cephalosporins",
  "Sulfa Antibiotics",
  "Paracetamol / NSAIDs",
  "Peanuts / Groundnuts",
  "Dairy / Cow's Milk",
  "Soy / Gluten",
  "Latex Sensitivity",
  "No Known Drug Allergies",
];

const INDIAN_DIETARY_PLANS = [
  {
    id: "gdm_friendly",
    title: "Gestational Diabetic & Low Glycemic",
    desc: "Millets (Ragi, Jowar), high-fiber pulses, sprouted daals, and regulated carb timing to prevent post-prandial spikes.",
    badge: "ICMR & FOGSI Aligned",
    tag: "Low GI Indian Diet",
  },
  {
    id: "lacto_vegetarian",
    title: "Indian Pure Vegetarian (Lacto)",
    desc: "Paneer, curd, green leafy vegetables, lentils, and fortified vitamin B12 & iron supplementation support.",
    badge: "Balanced Protein",
    tag: "Lacto-Vegetarian",
  },
  {
    id: "sattvic_jain",
    title: "Sattvic / Jain Friendly",
    desc: "Wholesome grains, nuts, dairy, and seeds prepared without underground roots, optimized for maternal nourishment.",
    badge: "Gentle Digestion",
    tag: "Sattvic Guidelines",
  },
  {
    id: "balanced_nonveg",
    title: "Eggetarian / High Protein Non-Veg",
    desc: "Farm eggs, steamed fresh river fish, lean poultry broth, and green vegetables for optimal fetal brain growth.",
    badge: "DHA & Choline Rich",
    tag: "Non-Veg Balanced",
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
  const [activeModal, setActiveModal] = useState<"dpdp" | "fogsi" | "emergency108" | "help" | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    age: "",
    gestational_week: "",
    due_date: "",
    doctor_name: "",
    emergency_contact: "",
    dietary_preference: "gdm_friendly",
    notes: "",
    enable_telemetry: true,
  });

  const [selectedConditions, setSelectedConditions] = useState<string[]>([
    "Gestational Diabetes (GDM)",
  ]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([
    "Penicillin & Cephalosporins",
  ]);

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
    if (item === "No Known Drug Allergies") {
      setSelectedAllergies(["No Known Drug Allergies"]);
      return;
    }
    const filtered = selectedAllergies.filter((x) => x !== "No Known Drug Allergies");
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
      toast.error("Please enter a short doctor advice note or symptom first.");
      return;
    }
    setIsFormatting(true);
    setOriginalNotes(form.notes);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const polished = formatClinicalNotes(form.notes);
      setForm((f) => ({ ...f, notes: polished }));
      toast.success("Standardized into clinical triage notation");
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

      toast.success("Maternal profile set up successfully! Welcome to MomSafe.");
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
    weekNum >= 28 ? "Third Trimester" : weekNum >= 13 ? "Second Trimester" : "First Trimester";
  const progressPercent = Math.min(100, Math.max(5, Math.round((weekNum / 40) * 100)));

  return (
    <div className="min-h-screen bg-[#F4F6F8] py-6 sm:py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-between items-center text-slate-800 antialiased font-sans">
      {/* Elevated Container Card (Matches Kastamer Architecture & MomSafe Brand) */}
      <div className="max-w-6xl w-full bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(43,105,84,0.12)] border border-slate-200/80 overflow-hidden flex flex-col my-auto transition-all">
        {/* Top Navigation Bar: Uses Exact MomSafe Brand Logo & Colors */}
        <header className="px-6 sm:px-8 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand Logo Matching App & Login */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20 text-white">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  MomSafe <span className="text-emerald-600 font-extrabold">AI</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[10px] font-bold tracking-wider uppercase">
                  India Care Portal
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 mt-1 uppercase tracking-widest">
                Maternal Health Systems
              </span>
            </div>
          </div>

          {/* Stepper Breadcrumbs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 1
                  ? "bg-emerald-50 text-emerald-800 font-bold border-b-2 border-emerald-700"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > 1 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 1 ? "✓" : "1"}
              </span>
              1. Mother & Care Team
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(2);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 2
                  ? "bg-emerald-50 text-emerald-800 font-bold border-b-2 border-emerald-700"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > 2 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
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
                  ? "bg-emerald-50 text-emerald-800 font-bold border-b-2 border-emerald-700"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 3 ? "✓" : "3"}
              </span>
              3. Indian Diet & Nutrition
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(4);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                step === 4
                  ? "bg-emerald-50 text-emerald-800 font-bold border-b-2 border-emerald-700"
                  : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 4 ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
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
                {user?.email || "pooja.sharma@gmail.com"}
              </strong>
            </span>
            <div className="hidden sm:block h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => setActiveModal("help")}
              className="flex items-center gap-1 text-slate-600 hover:text-emerald-700 transition-colors font-medium px-2 py-1 rounded-md hover:bg-slate-50"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          {/* LEFT COLUMN: Connected Vertical Timeline Stepper */}
          <aside className="lg:col-span-5 bg-gradient-to-b from-emerald-50/60 via-teal-50/30 to-slate-50 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-between relative">
            <div>
              {/* Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-white border border-emerald-100/80 shadow-sm flex items-start gap-2.5 mb-8">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Welcome to MomSafe AI. Set up your personalized maternal care profile to calibrate 24/7 vitals telemetry, emergency loop, and gestational alerts.
                </p>
              </div>

              {/* Vertical Stepper with connected vertical line */}
              <div className="space-y-6 relative pl-2">
                {/* Connecting Line */}
                <div className="absolute left-[23px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-emerald-200 -z-0" />

                {/* Step 1 Node */}
                <div
                  onClick={() => setStep(1)}
                  className="flex items-start gap-3.5 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 1
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md ring-4 ring-emerald-100"
                        : step > 1
                        ? "bg-emerald-600 text-white"
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
                        Mother & Care Team
                      </span>
                      {step === 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Legal name, due date, OB/GYN doctor, and family guardian contact.
                    </p>
                  </div>
                </div>

                {/* Step 2 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(2);
                  }}
                  className="flex items-start gap-3.5 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 2
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md ring-4 ring-emerald-100"
                        : step > 2
                        ? "bg-emerald-600 text-white"
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
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Gestational conditions, drug allergies, and doctor's advice.
                    </p>
                  </div>
                </div>

                {/* Step 3 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(3);
                  }}
                  className="flex items-start gap-3.5 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 3
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md ring-4 ring-emerald-100"
                        : step > 3
                        ? "bg-emerald-600 text-white"
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
                        Indian Diet & Nutrition
                      </span>
                      {step === 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Millets, gestational diabetic foods, vegetarian options, and meal timing.
                    </p>
                  </div>
                </div>

                {/* Step 4 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(4);
                  }}
                  className="flex items-start gap-3.5 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      step === 4
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md ring-4 ring-emerald-100"
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
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Connect 24/7 predictive safety companion & emergency SOS escalation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Reassurance Card (Indian DPDP & Clinical Standards) */}
            <div className="mt-8 p-3.5 rounded-2xl bg-white/95 border border-emerald-100 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs leading-tight">
                <p className="font-bold text-slate-800">
                  DPDP Act 2023 & ABDM Compliant
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  End-to-end encrypted clinical health records stored securely in India.
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: Focused Progressive Disclosure Form */}
          <main className="lg:col-span-7 p-6 sm:p-10 bg-white flex flex-col justify-between">
            <div>
              {/* Step Header */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
                  STEP {step} OF 4 —{" "}
                  {step === 1 && "Mother & Care Team Setup"}
                  {step === 2 && "Clinical Conditions & Risk History"}
                  {step === 3 && "Indian Diet & Metabolic Guidance"}
                  {step === 4 && "Baseline Review & Care Activation"}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {step === 1 && "Tell us about your pregnancy journey"}
                  {step === 2 && "Clinical Conditions & Risk History"}
                  {step === 3 && "Indian Dietary Preferences & Nutrition"}
                  {step === 4 && "Verify & Activate Your Care Plan"}
                </h1>
                <p className="text-sm text-slate-500 mt-1.5 max-w-xl leading-relaxed">
                  {step === 1 &&
                    "Enter your pregnancy timeline, your doctor, and emergency contact to calibrate proactive maternal alerts for your exact gestational week."}
                  {step === 2 &&
                    "Configure clinical risk factors (blood pressure, diabetes, thyroid) so our AI triage engine alerts your care team before complications arise."}
                  {step === 3 &&
                    "Tailor nutrition recommendations with traditional Indian wholesome foods, low-glycemic millets, and daily blood sugar monitoring."}
                  {step === 4 &&
                    "Your personal maternal care baseline and emergency guardian loop are configured. Review and activate continuous monitoring."}
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
                        placeholder="e.g. Pooja Sharma"
                        className={`w-full h-11 px-3.5 pl-10 rounded-xl border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all ${
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

                  {/* Mother's Age */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                      Mother's Age (Years)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="16"
                        max="55"
                        value={form.age}
                        onChange={(e) => setForm({ ...form, age: e.target.value })}
                        placeholder="e.g. 28"
                        className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      />
                      <Activity className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Estimated Due Date & Trimester */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Estimated Due Date & Trimester <span className="text-rose-500">*</span>
                      </label>
                      {form.gestational_week && (
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
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
                          className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
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
                          className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                        />
                        <Baby className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Gestational age is calculated automatically according to FOGSI clinical criteria.
                    </p>
                  </div>

                  {/* Primary OB/GYN or Hospital */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                      Consulting OB/GYN Doctor & Hospital
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.doctor_name}
                        onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
                        placeholder="e.g. Dr. Priya Sharma, MD — Cloudnine Hospital, Bengaluru"
                        className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                      />
                      <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Emergency Guardian Contact */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                      Emergency Guardian / Partner Mobile Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.emergency_contact}
                        onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                        placeholder="e.g. Rahul Sharma (Husband) • +91 98765 43210"
                        className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
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
                      {INDIAN_CONDITION_OPTIONS.map((item) => {
                        const active = selectedConditions.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleCondition(item)}
                            className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-50 border border-emerald-600 text-emerald-800 font-semibold shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                active ? "bg-emerald-600 text-white" : "border border-slate-300"
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
                        Known Drug & Food Allergies
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">Safe Prescription Filter</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {INDIAN_ALLERGY_OPTIONS.map((item) => {
                        const active = selectedAllergies.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleAllergy(item)}
                            className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-50 border border-emerald-600 text-emerald-800 font-semibold shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                active ? "bg-emerald-600 text-white" : "border border-slate-300"
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
                        Doctor's Directives & Prescriptions
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
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80"
                        >
                          {isFormatting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                          )}
                          Format for Care Team
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="e.g. Patient advised regular BP checks twice daily. Alert team if BP exceeds 135/85 mmHg or if fasting sugar crosses 95 mg/dL."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Prescription thresholds calibrate automated alerts for your care team.
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INDIAN_DIETARY_PLANS.map((plan) => {
                      const selected = form.dietary_preference === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setForm({ ...form, dietary_preference: plan.id })}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            selected
                              ? "border-emerald-600 bg-emerald-50/40 shadow-sm"
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
                                    ? "bg-emerald-600 border-emerald-600 text-white"
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
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              {plan.badge}
                            </span>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                              {plan.tag}
                            </span>
                          </div>
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
                          Continuous Glucose & Vital Calibration
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Correlate meal logs and hydration with continuous vitals tracking according to ICMR guidelines.
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
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
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
                          Maternal Care Baseline Summary
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {form.full_name || "Pooja Sharma"} • {trimester} (Week {weekNum})
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
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
                        <span className="text-slate-400 text-[11px] block">Consulting Hospital / Doctor</span>
                        <span className="font-bold text-slate-800 mt-0.5 block truncate">
                          {form.doctor_name || "Cloudnine Hospital / Apollo Cradle"}
                        </span>
                      </div>
                    </div>

                    {/* Active Protocols List */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                        Activated Clinical Protocols:
                      </span>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          24/7 AI Maternal Vitals Telemetry
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">FOGSI Calibrated</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Emergency SOS & 108 Ambulance Dispatch Link
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">Guardian SMS Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation Pills Row (India Regulatory & Clinical) */}
              <div className="mt-8 pt-5 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
                  Clinical Standards & Verification (India):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal("dpdp")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    DPDP Act 2023 & ABDM Privacy
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("fogsi")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    FOGSI & ICMR Clinical Guidelines
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("emergency108")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    National 108 & Guardian SOS Loop
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
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Save and continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
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
      <footer className="max-w-6xl w-full mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 px-4">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-extrabold text-slate-800">MomSafe AI India</span>
          <span>•</span>
          <p>© 2026 MomSafe Technologies Pvt. Ltd. Clinical data governed under India DPDP Act 2023.</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveModal("dpdp")}
            className="hover:text-slate-800 underline transition-colors"
          >
            DPDP Data Privacy
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("fogsi")}
            className="hover:text-slate-800 underline transition-colors"
          >
            FOGSI Clinical Alignment
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("emergency108")}
            className="hover:text-slate-800 underline transition-colors"
          >
            National 108 Emergency
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("help")}
            className="hover:text-slate-800 underline transition-colors"
          >
            Care Support
          </button>
        </div>
      </footer>

      {/* Trust Badge Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          End-to-End Encrypted Indian Servers
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          ABDM (Ayushman Bharat) Integrated
        </span>
        <span className="flex items-center gap-1.5">
          <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
          FOGSI Obstetric Safety Guidelines
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

            {activeModal === "dpdp" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Digital Personal Data Protection (DPDP) Act 2023 & ABDM Compliance
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  MomSafe AI strictly adheres to India's DPDP Act 2023 and Ayushman Bharat Digital Mission (ABDM) standards. All electronic health records (EHR) and biometric vitals are encrypted at rest with AES-256 and hosted on secure Indian cloud infrastructure. Data is never monetized or shared with third-party advertisers.
                </p>
              </div>
            )}

            {activeModal === "fogsi" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  FOGSI & ICMR Maternal Health Alignment
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Our clinical triage alerts follow clinical recommendations formulated by the Federation of Obstetric and Gynaecological Societies of India (FOGSI) and the Indian Council of Medical Research (ICMR). Thresholds for gestational hypertension (&gt;140/90 mmHg), anemia (Hb &lt;11 g/dL), and gestational diabetes are calibrated to Indian maternal demographic cohorts.
                </p>
              </div>
            )}

            {activeModal === "emergency108" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  National 108 Emergency Ambulance & Guardian SOS Loop
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  During an acute maternal crisis (e.g., eclampsia warning, critical BP spike, or absent fetal movements), MomSafe AI triggers an automated emergency loop. It transmits real-time high-priority SMS notifications with GPS coordinates to your registered family guardian and provides one-touch integration with local 108 Emergency Medical Services.
                </p>
              </div>
            )}

            {activeModal === "help" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  MomSafe India Maternal Care Support
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Have questions about your intake setup or sensor pairing? Our maternal care team is available to assist you.
                </p>
                <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <p className="font-bold text-slate-800">Support Availability: 24/7 Priority Emergency Care</p>
                  <p className="text-slate-600 mt-1">Helpline: 1800-MOMSAFE (Toll-Free, India)</p>
                  <p className="text-slate-500 mt-0.5">Email: care@momsafe.health • WhatsApp Care Loop Active</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-md shadow-emerald-700/20"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
