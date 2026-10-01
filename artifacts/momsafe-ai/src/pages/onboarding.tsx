import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Heart, User, Calendar, Stethoscope, ChevronRight, Loader2 } from "lucide-react";

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

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    full_name: "",
    age: "",
    gestational_week: "",
    due_date: "",
    doctor_name: "",
  });

  const errors = {
    full_name: validateName(form.full_name),
    age: validateAge(form.age),
    gestational_week: validateWeek(form.gestational_week),
    due_date: validateDueDate(form.due_date),
    doctor_name: validateDoctor(form.doctor_name),
  };
  const anyError = Object.values(errors).some(Boolean);

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
        setLocation("/dashboard");
      }
    })();
  }, [user, setLocation]);

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

  const handleSave = async () => {
    if (!user) return;
    setTouched({ full_name: true, age: true, gestational_week: true, due_date: true, doctor_name: true });
    if (errors.full_name) { toast.error(errors.full_name); return; }
    if (errors.age) { toast.error(errors.age); return; }
    if (errors.gestational_week) { toast.error(errors.gestational_week); return; }
    if (errors.due_date) { toast.error(errors.due_date); return; }
    if (errors.doctor_name) { toast.error(errors.doctor_name); return; }
    if (!form.full_name.trim()) { toast.error("Please enter your name"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("users").upsert(
        {
          id: user.id,
          full_name: form.full_name.trim(),
          age: Number(form.age) || null,
          gestational_week: Number(form.gestational_week) || null,
          due_date: form.due_date || null,
          doctor_name: form.doctor_name.trim() || null,
        },
        { onConflict: "id" }
      );

      if (error) throw error;

      toast.success("Welcome to MomSafe! 🎉");
      setTimeout(() => setLocation("/dashboard"), 800);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex flex-col items-center justify-center px-4 py-12 font-sans">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
          <Heart className="w-5 h-5" fill="white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xl font-black tracking-tighter text-slate-900">MomSafe</span>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600/70">Premium Care</span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.12)] p-8 md:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight mb-2">
            Let's set up your profile
          </h1>
          <p className="text-slate-500 font-semibold text-sm">
            This helps us personalise your health monitoring and insights.
          </p>
        </div>

        <div className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
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
              <p className="mt-2 text-xs font-semibold text-rose-600">{errors.full_name}</p>
            )}
          </div>

          {/* Age */}
          <div>
            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
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
              className={
                "w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all border " +
                (touched.age && errors.age
                  ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-400"
                  : "border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400")
              }
            />
            {touched.age && errors.age && (
              <p className="mt-2 text-xs font-semibold text-rose-600">{errors.age}</p>
            )}
          </div>

          {/* Pregnancy Week + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
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
                className={
                  "w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all border " +
                  (touched.gestational_week && errors.gestational_week
                    ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-400"
                    : "border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400")
                }
              />
              {touched.gestational_week && errors.gestational_week && (
                <p className="mt-2 text-xs font-semibold text-rose-600">{errors.gestational_week}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value, gestational_week: "" }))}
                onBlur={() => setTouched((t) => ({ ...t, due_date: true }))}
                className={
                  "w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 transition-all border " +
                  (touched.due_date && errors.due_date
                    ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-400"
                    : "border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400")
                }
              />
              {touched.due_date && errors.due_date && (
                <p className="mt-2 text-xs font-semibold text-rose-600">{errors.due_date}</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold -mt-2">Fill either one — the other auto-calculates.</p>

          {/* Doctor Name */}
          <div>
            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
              <Stethoscope className="w-3.5 h-3.5" />
              Doctor / Midwife Name
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Priya Sharma (optional)"
              value={form.doctor_name}
              onChange={(e) => setForm((f) => ({ ...f, doctor_name: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, doctor_name: true }))}
              className={
                "w-full px-4 py-3 rounded-2xl bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all border " +
                (touched.doctor_name && errors.doctor_name
                  ? "border-rose-400 focus:ring-rose-500/30 focus:border-rose-400"
                  : "border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-400")
              }
            />
            {touched.doctor_name && errors.doctor_name && (
              <p className="mt-2 text-xs font-semibold text-rose-600">{errors.doctor_name}</p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !form.full_name.trim() || anyError}
          className="mt-8 w-full flex items-center justify-center gap-3 py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 hover:scale-[1.01] active:scale-[0.99]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Go to Dashboard"}
        </button>

        <p className="text-center text-[11px] text-slate-400 font-semibold mt-4">
          You can update these anytime in Settings
        </p>
      </div>
    </div>
  );
}
