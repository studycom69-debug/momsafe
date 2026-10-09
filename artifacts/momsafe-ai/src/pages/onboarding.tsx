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
  Apple,
  Check,
  Lock,
  Baby,
  Utensils,
  ShieldAlert,
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const min = new Date(today); min.setDate(min.getDate() - 294);
  const max = new Date(today); max.setDate(max.getDate() + 294);
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

const DIABETIC_OPTIONS = [
  "Gestational Diabetes",
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Insulin Resistance / Pre-diabetes",
  "Frequent Sugar Spikes",
];

const ALLERGY_OPTIONS = [
  "Peanuts & Tree Nuts",
  "Dairy / Lactose",
  "Gluten / Wheat",
  "Penicillin & Antibiotics",
  "Eggs",
  "Shellfish & Seafood",
  "Sulfa Drugs",
  "Latex",
];

const CLINICAL_OPTIONS = [
  "High Blood Pressure / Preeclampsia",
  "Thyroid Disorder",
  "Severe Morning Sickness (HG)",
  "Iron Deficiency Anemia",
  "PCOS",
  "Asthma",
];

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Non-Vegetarian",
  "Eggetarian",
  "Halal",
  "Gluten-Free",
];

interface OnboardingProps {
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps = {}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [originalNotes, setOriginalNotes] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    full_name: "",
    age: "",
    gestational_week: "",
    due_date: "",
    doctor_name: "",
    dietary_preference: "",
    notes: "",
  });

  const [selectedDiabetic, setSelectedDiabetic] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  const errors = {
    full_name: validateName(form.full_name),
    age: validateAge(form.age),
    gestational_week: validateWeek(form.gestational_week),
    due_date: validateDueDate(form.due_date),
  };

  // If user already has a profile, skip to dashboard
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.full_name) {
        if (onComplete) onComplete();
        window.location.href = "/dashboard";
      }
    })();
  }, [user, onComplete]);

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

  const toggleChip = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleProceedToStep2 = () => {
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
  };

  const handleFormatNotes = async () => {
    if (!form.notes.trim()) {
      toast.error("Please write a short note first.");
      return;
    }

    setIsFormatting(true);
    setOriginalNotes(form.notes);

    try {
      await new Promise((r) => setTimeout(r, 450));
      const polished = formatClinicalNotes(form.notes);
      setForm((f) => ({ ...f, notes: polished }));
      toast.success("Notes formatted for your care team");
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
      toast.info("Restored original phrasing");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const allConditions = Array.from(new Set([...selectedDiabetic, ...selectedConditions]));
      const conditionsStr = allConditions.length > 0 ? allConditions.join(", ") : null;
      const allergiesStr = selectedAllergies.length > 0 ? selectedAllergies.join(", ") : null;

      const { error } = await supabase.from("users").upsert(
        {
          id: user.id,
          full_name: form.full_name.trim(),
          age: Number(form.age) || null,
          gestational_week: Number(form.gestational_week) || null,
          due_date: form.due_date || null,
          doctor_name: form.doctor_name.trim() || null,
          conditions: conditionsStr,
          allergies: allergiesStr,
          dietary_preference: form.dietary_preference || null,
          notes: form.notes.trim() || null,
        },
        { onConflict: "id" }
      );

      if (error) throw error;

      toast.success("Welcome to MomSafe! Your care baseline is set.");
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

  const weekNum = Number(form.gestational_week);
  const trimester =
    weekNum >= 28 ? "3rd Trimester" : weekNum >= 13 ? "2nd Trimester" : weekNum >= 1 ? "1st Trimester" : null;

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col md:flex-row antialiased w-full font-sans">
      
      {/* ──────────────── LEFT PANEL: STITCH-INSPIRED SHOWCASE ──────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden flex-col justify-between p-12 border-r border-slate-200/70"
        style={{
          background: [
            'radial-gradient(ellipse 75% 60% at 25% 25%, rgba(243, 232, 248, 0.70) 0%, transparent 60%)',
            'radial-gradient(ellipse 65% 55% at 75% 75%, rgba(220, 247, 237, 0.70) 0%, transparent 60%)',
            'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
          ].join(', '),
        }}
      >
        {/* Top Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-600/25">
            <Heart className="w-5 h-5" fill="white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl font-bold tracking-tight text-slate-900">MomSafe</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700/80 mt-0.5">
              Maternal Health Companion
            </span>
          </div>
        </div>

        {/* Center Live Care Card Preview */}
        <div className="my-auto py-8">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-7 border border-slate-200/80 shadow-[0_30px_70px_-20px_rgba(15,23,42,0.12)] space-y-6">
            
            {/* Mother Card Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Live Intake Profile</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {form.full_name.trim() || "Expecting Mother"}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {form.gestational_week ? `Week ${form.gestational_week}` : "Pregnancy Profile"}
                  {trimester ? ` · ${trimester}` : ""}
                  {form.age ? ` · Age ${form.age}` : ""}
                </p>
              </div>

              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-100">
                <Baby className="w-5 h-5" />
              </div>
            </div>

            {/* Vital Safety Zone Indicators */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Pulse</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                  <span>60–100</span>
                  <span className="text-[10px] font-normal text-slate-400">bpm</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-1">Trimester Calibrated</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">BP Safe Zone</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">&lt; 140/90</div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-1">Pre-eclampsia Guard</div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Glucose</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  {selectedDiabetic.length > 0 ? "Tracking" : "Standard"}
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                  {selectedDiabetic.length > 0 ? "Active Monitor" : "Normal Target"}
                </div>
              </div>
            </div>

            {/* Active Safeguards Pill List */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
              {selectedAllergies.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  {selectedAllergies.length} Allergen filter{selectedAllergies.length > 1 ? "s" : ""} active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  No food allergens reported
                </span>
              )}

              {form.dietary_preference && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  <Utensils className="w-3 h-3 text-teal-600" />
                  {form.dietary_preference}
                </span>
              )}

              {selectedDiabetic.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                  <Activity className="w-3 h-3 text-rose-600" />
                  Diabetic Profile Active
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Bottom Trust Indicators */}
        <div className="space-y-2.5 pt-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Continuous tracking calibrated across 14 maternal biomarkers</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>HIPAA-aligned encrypted storage · Only shared with authorized care teams</span>
          </div>
        </div>
      </div>

      {/* ──────────────── RIGHT PANEL: INTAKE FORM ──────────────── */}
      <div className="flex-1 flex flex-col justify-between px-6 py-8 sm:px-12 md:px-16 lg:px-20 overflow-y-auto">
        
        <div className="w-full max-w-xl mx-auto my-auto py-6">

          {/* Stepper Progress Bar (Subtle & Clean) */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span className="text-slate-900 font-bold">
                {step === 1 ? "Step 1 of 2: Pregnancy Profile" : "Step 2 of 2: Health & Safety Baseline"}
              </span>
              <span className="text-emerald-700 font-bold">{step === 1 ? "50%" : "Almost Done"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" />
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  step === 2 ? "bg-emerald-600" : "bg-transparent"
                }`}
              />
            </div>
          </div>

          {/* ──────── STEP 1: PREGNANCY PROFILE ──────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Welcome to MomSafe
                </h1>
                <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                  Enter your pregnancy details to set baseline thresholds and customize daily insights.
                </p>
              </div>

              <div className="space-y-5 pt-2">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
                    className={`w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all border ${
                      touched.full_name && errors.full_name
                        ? "border-rose-300 focus:ring-rose-100 focus:border-rose-500"
                        : "border-slate-200 focus:ring-emerald-100 focus:border-emerald-600"
                    }`}
                  />
                  {touched.full_name && errors.full_name && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.full_name}</p>
                  )}
                </div>

                {/* Age & Pregnancy Week */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Age */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Age <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 29"
                      min={15}
                      max={55}
                      value={form.age}
                      onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                    />
                    {touched.age && errors.age && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.age}</p>
                    )}
                  </div>

                  {/* Gestational Week */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Current Week
                      </label>
                      {trimester && (
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {trimester}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="e.g. 20"
                      min={1}
                      max={42}
                      value={form.gestational_week}
                      onChange={(e) => setForm((f) => ({ ...f, gestational_week: e.target.value, due_date: "" }))}
                      onBlur={() => setTouched((t) => ({ ...t, gestational_week: true }))}
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                    />
                    {touched.gestational_week && errors.gestational_week && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.gestational_week}</p>
                    )}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Estimated Due Date <span className="text-slate-400 font-normal">(Auto-calculated if week entered)</span>
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value, gestational_week: "" }))}
                    onBlur={() => setTouched((t) => ({ ...t, due_date: true }))}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                  />
                  {touched.due_date && errors.due_date && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.due_date}</p>
                  )}
                </div>

                {/* OB-GYN or Midwife Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Primary OB-GYN or Midwife <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Priya Sharma, Cloudnine Hospital"
                    value={form.doctor_name}
                    onChange={(e) => setForm((f) => ({ ...f, doctor_name: e.target.value }))}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                  />
                </div>
              </div>

              {/* Continue Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  disabled={!form.full_name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-all shadow-md active:scale-[0.98]"
                >
                  <span>Continue to Health Baseline</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ──────── STEP 2: HEALTH & CLINICAL BASELINE ──────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Health Baseline &amp; Safety
                </h1>
                <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                  Select any that apply to calibrate nutrition recommendations, glucose triggers, and maternal alerts.
                </p>
              </div>

              <div className="space-y-6 pt-2">
                {/* 1. Blood Sugar & Diabetes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Blood Sugar &amp; Diabetes
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Select any</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDiabetic([])}
                      className={`px-3.5 py-2 rounded-xl text-xs transition-all border ${
                        selectedDiabetic.length === 0
                          ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-xs"
                          : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                      }`}
                    >
                      None / Normal
                    </button>
                    {DIABETIC_OPTIONS.map((opt) => {
                      const active = selectedDiabetic.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleChip(selectedDiabetic, setSelectedDiabetic, opt)}
                          className={`px-3.5 py-2 rounded-xl text-xs transition-all border flex items-center gap-1.5 ${
                            active
                              ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                              : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Allergies & Sensitivities */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Allergies &amp; Sensitivities
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Excludes from meal plans</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAllergies([])}
                      className={`px-3.5 py-2 rounded-xl text-xs transition-all border ${
                        selectedAllergies.length === 0
                          ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-xs"
                          : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                      }`}
                    >
                      No Known Allergies
                    </button>
                    {ALLERGY_OPTIONS.map((opt) => {
                      const active = selectedAllergies.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleChip(selectedAllergies, setSelectedAllergies, opt)}
                          className={`px-3.5 py-2 rounded-xl text-xs transition-all border flex items-center gap-1.5 ${
                            active
                              ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                              : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Clinical Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Clinical Considerations
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Select any</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedConditions([])}
                      className={`px-3.5 py-2 rounded-xl text-xs transition-all border ${
                        selectedConditions.length === 0
                          ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-xs"
                          : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                      }`}
                    >
                      None
                    </button>
                    {CLINICAL_OPTIONS.map((opt) => {
                      const active = selectedConditions.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleChip(selectedConditions, setSelectedConditions, opt)}
                          className={`px-3.5 py-2 rounded-xl text-xs transition-all border flex items-center gap-1.5 ${
                            active
                              ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                              : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Dietary Preference */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Dietary Preference <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_OPTIONS.map((diet) => {
                      const active = form.dietary_preference === diet;
                      return (
                        <button
                          key={diet}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, dietary_preference: active ? "" : diet }))}
                          className={`px-3.5 py-2 rounded-xl text-xs transition-all border ${
                            active
                              ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                              : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-white font-medium"
                          }`}
                        >
                          {diet}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Additional Care Notes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Additional Notes or Symptoms <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>

                    {originalNotes !== null && (
                      <button
                        type="button"
                        onClick={handleUndoFormat}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Undo formatting
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder="e.g. Expecting twins, high morning sickness, taking thyroid medicine before breakfast..."
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50/70 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all resize-none"
                    />

                    {form.notes.trim().length > 3 && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Write in your own everyday words.
                        </span>
                        <button
                          type="button"
                          onClick={handleFormatNotes}
                          disabled={isFormatting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50"
                        >
                          {isFormatting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                          )}
                          <span>{isFormatting ? "Formatting..." : "Format into clinical summary"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={saving}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 px-3 py-2 transition-colors"
                  >
                    Skip &amp; Finish
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-full transition-all shadow-md active:scale-[0.98]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving profile...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete &amp; Open Dashboard</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ──────── BOTTOM REASSURANCE (WHERE IT BELONGS) ──────── */}
        <div className="pt-6 pb-2 text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100">
          <span className="flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            HIPAA-Aligned &amp; 256-Bit Encrypted
          </span>
          <span>&bull;</span>
          <span>All health profile details can be updated anytime in Settings</span>
        </div>

      </div>

    </div>
  );
}
