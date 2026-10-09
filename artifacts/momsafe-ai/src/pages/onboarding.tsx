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
  Info,
  Clock,
  Lock,
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

// Clean clinical formatter that structures casual notes into professional health context
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

  // Capitalize clean sentences
  text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  if (!/[.!?]$/.test(text)) text += ".";

  return `Patient notes: ${text}`;
}

const DIABETIC_OPTIONS = [
  "Gestational Diabetes",
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Insulin Resistance / Pre-diabetes",
  "Frequent Blood Sugar Spikes",
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFormatNotes = async () => {
    if (!form.notes.trim()) {
      toast.error("Please write a short note first.");
      return;
    }

    setIsFormatting(true);
    setOriginalNotes(form.notes);

    try {
      // Simulate/call clinical formatter
      await new Promise((r) => setTimeout(r, 400));
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

      toast.success("Welcome to MomSafe! Your profile is set.");
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

  // Helper for pregnancy stage badge
  const weekNum = Number(form.gestational_week);
  const trimester =
    weekNum >= 28 ? "3rd Trimester" : weekNum >= 13 ? "2nd Trimester" : weekNum >= 1 ? "1st Trimester" : null;

  return (
    <div className="min-h-screen bg-[#f8fafb] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Reassurance Bar */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/20">
              <Heart className="w-4 h-4" fill="currentColor" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900">MomSafe</span>
              <span className="text-[11px] font-semibold text-slate-400">Clinical Onboarding</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200/50">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>Private &amp; HIPAA-aligned</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-2xl">
          
          {/* Stepper Progress Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2.5">
              <span>{step === 1 ? "Step 1 of 2: Pregnancy Profile" : "Step 2 of 2: Health & Safety Baseline"}</span>
              <span className="text-emerald-700 font-bold">{step === 1 ? "50% Complete" : "Almost Done"}</span>
            </div>
            
            {/* Segmented Progress Bar */}
            <div className="grid grid-cols-2 gap-2 h-1.5 w-full">
              <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" />
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  step === 2 ? "bg-emerald-600" : "bg-slate-200"
                }`}
              />
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.06)] p-7 md:p-10">

            {/* ─────────────── STEP 1: PREGNANCY PROFILE ─────────────── */}
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl md:text-[28px] font-bold text-slate-900 tracking-tight leading-snug">
                    Tell us about your pregnancy
                  </h1>
                  <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                    This calibrates your daily monitoring thresholds, vitals tracking, and fetal development milestones.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. Sarah Jenkins"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                        onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
                        className={`w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all border ${
                          touched.full_name && errors.full_name
                            ? "border-rose-300 focus:ring-rose-100 focus:border-rose-500"
                            : "border-slate-200 focus:ring-emerald-100 focus:border-emerald-600"
                        }`}
                      />
                    </div>
                    {touched.full_name && errors.full_name && (
                      <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.full_name}
                      </p>
                    )}
                  </div>

                  {/* Age & Pregnancy Week Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Age */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
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
                        className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                      />
                      {touched.age && errors.age && (
                        <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.age}</p>
                      )}
                    </div>

                    {/* Gestational Week */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700">
                          Current Pregnancy Week
                        </label>
                        {trimester && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
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
                        className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                      />
                      {touched.gestational_week && errors.gestational_week && (
                        <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.gestational_week}</p>
                      )}
                    </div>
                  </div>

                  {/* Estimated Due Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Estimated Due Date <span className="text-slate-400 font-normal">(Calculated automatically if week is entered)</span>
                    </label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value, gestational_week: "" }))}
                      onBlur={() => setTouched((t) => ({ ...t, due_date: true }))}
                      className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                    />
                    {touched.due_date && errors.due_date && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.due_date}</p>
                    )}
                  </div>

                  {/* Primary Care Provider */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      OB-GYN or Midwife Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Priya Sharma, Cloudnine Hospital"
                      value={form.doctor_name}
                      onChange={(e) => setForm((f) => ({ ...f, doctor_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all"
                    />
                  </div>
                </div>

                {/* Continue CTA */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleProceedToStep2}
                    disabled={!form.full_name.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99]"
                  >
                    <span>Continue to Health Baseline</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────── STEP 2: HEALTH & CLINICAL CONTEXT ─────────────── */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl md:text-[28px] font-bold text-slate-900 tracking-tight leading-snug">
                    Health Baseline &amp; Safety Profile
                  </h1>
                  <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                    Select any that apply. This helps MomSafe customize safety alerts, nutrition suggestions, and glucose tracking.
                  </p>
                </div>

                <div className="space-y-7">
                  {/* Section 1: Blood Sugar & Diabetic Considerations */}
                  <div className="bg-slate-50/70 rounded-2xl p-4 md:p-5 border border-slate-200/60">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Blood Sugar &amp; Diabetes
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Select any</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDiabetic([])}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                          selectedDiabetic.length === 0
                            ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
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
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all border flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Allergies & Intolerances */}
                  <div className="bg-slate-50/70 rounded-2xl p-4 md:p-5 border border-slate-200/60">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Allergies &amp; Sensitivities
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Excludes from recipes</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAllergies([])}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                          selectedAllergies.length === 0
                            ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
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
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all border flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Clinical Considerations */}
                  <div className="bg-slate-50/70 rounded-2xl p-4 md:p-5 border border-slate-200/60">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Pre-existing or Clinical Conditions
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Select any</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedConditions([])}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                          selectedConditions.length === 0
                            ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
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
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all border flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 4: Dietary Preference */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
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
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                              active
                                ? "bg-slate-900 text-white border-slate-900 font-semibold"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium"
                            }`}
                          >
                            {diet}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 5: Specific Notes / Health History */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700">
                        Additional Notes or Concerns <span className="text-slate-400 font-normal">(Optional)</span>
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
                        placeholder="e.g. Expecting twins, high nausea in mornings, taking thyroid medicine before breakfast..."
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-100 focus:border-emerald-600 transition-all resize-none"
                      />

                      {/* Clinical Auto-Formatter Action (Refined, Native Health Tool Style) */}
                      {form.notes.trim().length > 3 && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            You can write in everyday words.
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

                {/* Footer Controls */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Profile
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
                      className="inline-flex items-center justify-center gap-2 py-3 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99]"
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

          {/* Under-Card Trust Line */}
          <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              HIPAA &amp; Encrypted Data
            </span>
            <span>&bull;</span>
            <span>You can update these details anytime in Settings</span>
          </div>

        </div>
      </main>
    </div>
  );
}
