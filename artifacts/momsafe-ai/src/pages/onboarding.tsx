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
  ShieldAlert,
  Apple,
  Activity,
  Check,
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
  if (words.length < 2) return "Please enter your full name (first + last)";
  const banned = /^(xyz|abc|test|user|demo|qwe|asd|poop|fuck|shit|123|none|null|fake)$/i;
  for (const w of words) if (banned.test(w.replace(/[^a-z]/gi, ""))) return "Please enter a proper name";
  return null;
}

function validateAge(age: string): string | null {
  if (!age) return null;
  const n = Number(age);
  if (!Number.isFinite(n)) return "Age must be a number";
  if (!Number.isInteger(n)) return "Age must be a whole number";
  if (n < 15) return "Age must be at least 15";
  if (n > 55) return "Age must be 55 or under";
  return null;
}

function validateWeek(w: string): string | null {
  if (!w) return null;
  const n = Number(w);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Pregnancy week must be a whole number";
  if (n < 1 || n > 42) return "Pregnancy week must be between 1 and 42";
  return null;
}

function validateDueDate(d: string): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "Please pick a valid date";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const min = new Date(today); min.setDate(min.getDate() - 294);
  const max = new Date(today); max.setDate(max.getDate() + 294);
  if (dt < min) return "Due date is too far in the past";
  if (dt > max) return "Due date is too far in the future";
  return null;
}

function validateDoctor(d: string): string | null {
  if (!d.trim()) return null;
  const v = d.trim();
  if (v.length < 2) return "Doctor name is too short";
  if (v.length > 100) return "Doctor name is too long";
  if (/\d{3,}/.test(v)) return "Doctor name should not have long numbers";
  return null;
}

// Client-side AI polisher fallback that cleans and structures medical notes
function polishHealthNotesClient(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Replace common shortcuts & colloquialisms with clear health terminology
  const replacements: [RegExp, string][] = [
    [/\bbp\b/gi, "blood pressure"],
    [/\bgd\b/gi, "gestational diabetes"],
    [/\bhg\b/gi, "hyperemesis gravidarum (severe nausea)"],
    [/\bhb\b/gi, "hemoglobin / iron level"],
    [/\bc[-\s]?sec\b|\bcsection\b/gi, "Caesarean delivery"],
    [/\bvomit(ing)?|puking\b/gi, "nausea and emesis"],
    [/\bdizzy\b/gi, "dizziness"],
    [/\bfaint(ing)?\b/gi, "presyncope / lightheadedness"],
    [/\bsugar spike(s)?\b/gi, "postprandial glucose spikes"],
    [/\btired(ness)?\b/gi, "generalized fatigue"],
    [/\bheadache(s)?\b/gi, "frequent cephalalgia (headaches)"],
    [/\bswelling\b/gi, "peripheral edema (swelling)"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  // Capitalize sentences
  text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  if (!/[.!?]$/.test(text)) text += ".";

  return `Mother reports: ${text}`;
}

const DIABETIC_OPTIONS = [
  "Gestational Diabetes",
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Pre-diabetic / Insulin Resistance",
  "Prone to Sugar Spikes",
];

const ALLERGY_OPTIONS = [
  "Peanuts & Tree Nuts",
  "Dairy / Lactose",
  "Gluten / Wheat",
  "Penicillin & Antibiotics",
  "Eggs",
  "Shellfish / Seafood",
  "Sulfa Drugs",
  "Latex",
];

const HEALTH_OPTIONS = [
  "High Blood Pressure / Preeclampsia",
  "Thyroid (Hypo/Hyper)",
  "Severe Morning Sickness (HG)",
  "Anemia (Low Iron)",
  "PCOS",
  "Asthma",
];

const DIET_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Non-Vegetarian",
  "Eggetarian",
  "Halal",
];

interface OnboardingProps {
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps = {}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
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
    doctor_name: validateDoctor(form.doctor_name),
  };
  const step1HasError = !!(errors.full_name || errors.age || errors.gestational_week || errors.due_date || errors.doctor_name);

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

  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleNextStep = () => {
    setTouched({ full_name: true, age: true, gestational_week: true, due_date: true, doctor_name: true });
    if (errors.full_name) {
      toast.error(errors.full_name);
      return;
    }
    if (step1HasError) {
      toast.error("Please resolve errors in the form before proceeding");
      return;
    }
    setStep(2);
  };

  const handlePolishNotes = async () => {
    if (!form.notes.trim()) {
      toast.error("Please write something in the notes first");
      return;
    }

    setIsPolishing(true);
    setOriginalNotes(form.notes);

    try {
      // Attempt Edge Function call first
      let polished = "";
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-guidance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ rewriteNotes: true, text: form.notes }),
        });
        if (res.ok) {
          const data = await res.json();
          polished = data?.rewrittenText || data?.text || "";
        }
      } catch {
        // Fall back to client polisher
      }

      if (!polished) {
        polished = polishHealthNotesClient(form.notes);
      }

      setForm((f) => ({ ...f, notes: polished }));
      toast.success("Notes refined by MomSafe AI! ✨");
    } catch {
      toast.error("Could not polish notes right now");
    } finally {
      setIsPolishing(false);
    }
  };

  const handleUndoPolish = () => {
    if (originalNotes !== null) {
      setForm((f) => ({ ...f, notes: originalNotes }));
      setOriginalNotes(null);
      toast.info("Restored original notes");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Combine diabetic conditions + other health conditions
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

      toast.success("Welcome to MomSafe! 🎉");
      if (onComplete) {
        onComplete();
      }
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex flex-col items-center justify-center px-4 py-8 md:py-12 font-sans">
      {/* Top Brand Logo */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
          <Heart className="w-5 h-5" fill="white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xl font-black tracking-tighter text-slate-900">MomSafe</span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600/70">AI Care Companion</span>
        </div>
      </div>

      {/* Main Form Container Card */}
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.12)] p-6 md:p-10">
        
        {/* Step Progress Pill */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase ${
                step === 1 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
              }`}
            >
              Step 1: Basics
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase ${
                step === 2 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
              }`}
            >
              Step 2: AI Health Profile
            </span>
          </div>

          {step === 2 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors"
            >
              Skip to Dashboard
            </button>
          )}
        </div>

        {/* ──────────────── STEP 1: BASICS ──────────────── */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight mb-2">
                Let's set up your profile
              </h1>
              <p className="text-slate-500 font-semibold text-sm">
                Essential details so MomSafe can personalize your care.
              </p>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                  <User className="w-3.5 h-3.5" />
                  Full Name <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Johnson"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
                  className={
                    "w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all border " +
                    (touched.full_name && errors.full_name
                      ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-400"
                      : "border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400")
                  }
                />
                {touched.full_name && errors.full_name && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.full_name}</p>
                )}
              </div>

              {/* Age */}
              <div>
                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Age
                </label>
                <input
                  type="number"
                  placeholder="e.g. 28"
                  min={15}
                  max={55}
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Pregnancy Week + Due Date */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                    Pregnancy Week
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 20"
                    min={1}
                    max={42}
                    value={form.gestational_week}
                    onChange={(e) => setForm((f) => ({ ...f, gestational_week: e.target.value, due_date: "" }))}
                    onBlur={() => setTouched((t) => ({ ...t, gestational_week: true }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value, gestational_week: "" }))}
                    onBlur={() => setTouched((t) => ({ ...t, due_date: true }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold -mt-1">Fill either one — the other auto-calculates.</p>

              {/* Doctor Name */}
              <div>
                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  Doctor / Midwife Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Priya Sharma (optional)"
                  value={form.doctor_name}
                  onChange={(e) => setForm((f) => ({ ...f, doctor_name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                />
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextStep}
              disabled={!form.full_name.trim()}
              className="mt-6 w-full flex items-center justify-center gap-2.5 py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-slate-900/20 hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Next: AI Health Context</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ──────────────── STEP 2: AI HEALTH CONTEXT ──────────────── */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                AI Health Personalization
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight mb-1.5">
                Help AI protect your care
              </h1>
              <p className="text-slate-500 font-semibold text-xs leading-relaxed">
                Tap whatever applies to you. This enables MomSafe AI to flag allergy risks and diabetic triggers accurately.
              </p>
            </div>

            <div className="space-y-5">
              {/* 1. Blood Sugar & Diabetic Profile */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 mb-2">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  Blood Sugar & Diabetic Profile
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDiabetic([])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedDiabetic.length === 0
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Normal / None
                  </button>
                  {DIABETIC_OPTIONS.map((opt) => {
                    const active = selectedDiabetic.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleItem(selectedDiabetic, setSelectedDiabetic, opt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          active
                            ? "bg-rose-50 text-rose-700 border-rose-300 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-rose-600" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Allergies & Intolerances */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  Allergies & Sensitivities
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAllergies([])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedAllergies.length === 0
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    No Allergies
                  </button>
                  {ALLERGY_OPTIONS.map((opt) => {
                    const active = selectedAllergies.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleItem(selectedAllergies, setSelectedAllergies, opt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          active
                            ? "bg-amber-50 text-amber-800 border-amber-300 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-amber-600" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Other Health Conditions */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 mb-2">
                  <Heart className="w-3.5 h-3.5 text-emerald-500" />
                  Other Health Conditions
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedConditions([])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedConditions.length === 0
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    None
                  </button>
                  {HEALTH_OPTIONS.map((opt) => {
                    const active = selectedConditions.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleItem(selectedConditions, setSelectedConditions, opt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          active
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-emerald-600" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Dietary Preference */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-600 mb-2">
                  <Apple className="w-3.5 h-3.5 text-teal-500" />
                  Dietary Preference (Optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((diet) => {
                    const active = form.dietary_preference === diet;
                    return (
                      <button
                        key={diet}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, dietary_preference: active ? "" : diet }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          active
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {diet}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Custom Health Notes with AI Rewrite Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-600">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    Anything else you want MomSafe AI to know?
                  </label>
                  {originalNotes !== null && (
                    <button
                      type="button"
                      onClick={handleUndoPolish}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Undo AI Edit
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Write casually in any wording — e.g. feeling dizzy after eating sweets, taking thyroid meds in morning, expecting twins, sensitive stomach..."
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 border border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
                  />
                  
                  {form.notes.trim().length > 3 && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handlePolishNotes}
                        disabled={isPolishing}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-[11px] uppercase tracking-wider shadow-md shadow-violet-500/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isPolishing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                        )}
                        <span>{isPolishing ? "Polishing with AI..." : "✨ Rewrite & Polish with AI"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Back & Submit Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={saving}
                className="py-4 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[12px] uppercase tracking-[0.15em] rounded-2xl transition-all flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-[0.99]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                {saving ? "Saving..." : "Go to Dashboard"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
