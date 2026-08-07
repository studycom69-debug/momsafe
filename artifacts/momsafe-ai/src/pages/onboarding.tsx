import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Heart, User, Calendar, Stethoscope, ChevronRight, Loader2 } from "lucide-react";

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    age: "",
    gestational_week: "",
    due_date: "",
    doctor_name: "",
  });

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
    if (!form.full_name.trim()) {
      toast.error("Please enter your name");
      return;
    }

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
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
            />
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
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
            />
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
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value, gestational_week: "" }))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              />
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
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
            />
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !form.full_name.trim()}
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
