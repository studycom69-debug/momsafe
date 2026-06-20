import { useState, useEffect, useCallback } from "react";
import { Pill, Check, Bell, Clock, Plus, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface Medication {
  id: string;
  name: string;
  dose: string;
  time: string;
  category: string;
  color: string;
}

interface MedLog {
  medication_id: string;
  taken_date: string;
}

const COLOR_OPTIONS = [
  { label: "Blue", value: "blue", bg: "bg-blue-100", text: "text-blue-600", dot: "bg-blue-500" },
  { label: "Green", value: "green", bg: "bg-emerald-100", text: "text-emerald-600", dot: "bg-emerald-500" },
  { label: "Purple", value: "purple", bg: "bg-purple-100", text: "text-purple-600", dot: "bg-purple-500" },
  { label: "Amber", value: "amber", bg: "bg-amber-100", text: "text-amber-600", dot: "bg-amber-500" },
  { label: "Red", value: "red", bg: "bg-red-100", text: "text-red-600", dot: "bg-red-500" },
];

const getColor = (color: string) =>
  COLOR_OPTIONS.find((c) => c.value === color) ?? COLOR_OPTIONS[0];

export default function Medication() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [takenToday, setTakenToday] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ date: string; logs: MedLog[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dose: "",
    time: "08:00",
    category: "Supplement",
    color: "blue",
  });

  const today = new Date().toISOString().split("T")[0];

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString().split("T")[0];

      const [{ data: meds, error: medErr }, { data: logs, error: logErr }] =
        await Promise.all([
          supabase
            .from("medications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("medication_logs")
            .select("medication_id, taken_date")
            .eq("user_id", user.id)
            .gte("taken_date", sevenDaysAgo),
        ]);

      if (medErr) throw medErr;
      if (logErr) throw logErr;

      setMedications(meds ?? []);

      const todaySet = new Set(
        (logs ?? [])
          .filter((l) => l.taken_date === today)
          .map((l) => l.medication_id)
      );
      setTakenToday(todaySet);

      const last7: { date: string; logs: MedLog[] }[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = subDays(new Date(), i).toISOString().split("T")[0];
        last7.push({
          date: format(subDays(new Date(), i), "MMM d"),
          logs: (logs ?? []).filter((l) => l.taken_date === d),
        });
      }
      setHistory(last7);
    } catch (err) {
      console.error("Failed to load medication data:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleTaken = async (medId: string) => {
    if (!user?.id || toggling) return;
    setToggling(medId);
    const isTaken = takenToday.has(medId);

    try {
      if (isTaken) {
        const { error } = await supabase
          .from("medication_logs")
          .delete()
          .eq("user_id", user.id)
          .eq("medication_id", medId)
          .eq("taken_date", today);
        if (error) throw error;
        setTakenToday((prev) => {
          const next = new Set(prev);
          next.delete(medId);
          return next;
        });
        toast.info("Marked as not taken");
      } else {
        const { error } = await supabase.from("medication_logs").insert({
          user_id: user.id,
          medication_id: medId,
          taken_date: today,
        });
        if (error) throw error;
        setTakenToday((prev) => new Set([...prev, medId]));
        toast.success("Marked as taken ✓");
      }
    } catch (err: any) {
      toast.error("Failed to update. Please try again.");
      console.error(err);
    } finally {
      setToggling(null);
    }
  };

  const handleAdd = async () => {
    if (!user?.id) return;
    if (!form.name.trim() || !form.dose.trim()) {
      toast.error("Name and dose are required.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("medications").insert({
        user_id: user.id,
        name: form.name.trim(),
        dose: form.dose.trim(),
        time: form.time,
        category: form.category,
        color: form.color,
      });
      if (error) throw error;
      toast.success(`${form.name} added`);
      setForm({ name: "", dose: "", time: "08:00", category: "Supplement", color: "blue" });
      setShowAdd(false);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to add medication.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (medId: string, medName: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("medications")
      .delete()
      .eq("id", medId)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Could not delete medication.");
      return;
    }
    toast.success(`${medName} removed`);
    await loadData();
  };

  const takenCount = takenToday.size;
  const totalCount = medications.length;
  const adherencePct = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const todayFormatted = format(new Date(), "MMM d");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Medication Manager</h1>
          <p className="page-subtitle">Track prescriptions, supplements, and daily adherence.</p>
        </div>
        <div className="flex gap-2">
          <button className="ghost-btn" onClick={() => toast.info("Reminders coming soon")}>
            <Bell className="w-4 h-4" /> Set Reminder
          </button>
          <button className="action-btn" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Medication
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Today's Adherence</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{adherencePct}%</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${adherencePct}%` }}
            />
          </div>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Taken Today</p>
          <p className="text-3xl font-bold text-emerald-600 tabular-nums">{takenCount}</p>
          <p className="text-xs text-gray-400 mt-1">of {totalCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Pending</p>
          <p className="text-3xl font-bold text-amber-500 tabular-nums">
            {totalCount - takenCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">remaining</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">This Week</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {history.reduce((acc, d) => acc + d.logs.length, 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">doses taken</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Today's medications */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Today's Medications — {todayFormatted}
          </h2>

          {loading ? (
            <div className="card p-10 flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm font-medium">Loading medications…</p>
            </div>
          ) : medications.length === 0 ? (
            <div className="card p-10 flex flex-col items-center justify-center text-center border-dashed border-2 border-gray-200 bg-gray-50/50">
              <div className="w-14 h-14 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-4">
                <Pill className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">No medications added yet</p>
              <p className="text-xs text-gray-400 mb-5 max-w-[220px]">
                Add your prescriptions and supplements to track them here.
              </p>
              <button className="action-btn" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4" /> Add First Medication
              </button>
            </div>
          ) : (
            medications.map((med) => {
              const isTaken = takenToday.has(med.id);
              const isToggling = toggling === med.id;
              const col = getColor(med.color);
              return (
                <div
                  key={med.id}
                  className={`card p-4 border-l-4 transition-all duration-300 ${
                    isTaken ? "border-l-emerald-400 bg-emerald-50/20" : "border-l-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isTaken ? "bg-emerald-100" : col.bg
                      }`}
                    >
                      <Pill
                        className={`w-5 h-5 ${isTaken ? "text-emerald-600" : col.text}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{med.name}</p>
                        <span className="badge-gray text-[10px]">{med.category}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Pill className="w-3 h-3" />
                          {med.dose}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {med.time}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTaken ? (
                        <span className="badge-green">Taken</span>
                      ) : (
                        <span className="badge-yellow">Pending</span>
                      )}
                      <button
                        onClick={() => toggleTaken(med.id)}
                        disabled={isToggling}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                          isTaken
                            ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                            : "border-gray-200 text-gray-400 hover:bg-gray-50"
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(med.id, med.name)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-100 text-gray-300 hover:text-red-400 hover:border-red-200 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar: Schedule + History */}
        <div className="space-y-4">
          {/* Schedule derived from real medications */}
          {medications.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Daily Schedule</h2>
              <div className="space-y-2">
                {[...medications]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((med, i, arr) => {
                    const col = getColor(med.color);
                    return (
                      <div key={med.id} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 font-mono w-14">
                            {med.time}
                          </span>
                          {i < arr.length - 1 && (
                            <div
                              className="w-px h-5 bg-gray-100 mt-1"
                              style={{ marginLeft: 27 }}
                            />
                          )}
                        </div>
                        <div
                          className={`text-xs font-medium px-2 py-1 rounded-lg border ${col.bg} ${col.text} border-transparent`}
                        >
                          {med.name}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 7-day history from real logs */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent History</h2>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : history.every((d) => d.logs.length === 0) && medications.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No history yet. Start marking medications as taken.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((day) => {
                  const dayTaken = day.logs.length;
                  const pct = totalCount > 0 ? Math.round((dayTaken / totalCount) * 100) : 0;
                  return (
                    <div key={day.date} className="py-2 border-b border-gray-50 last:border-0">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-600">{day.date}</span>
                        <span
                          className={`text-xs font-semibold ${
                            dayTaken === totalCount && totalCount > 0
                              ? "text-emerald-600"
                              : dayTaken > 0
                              ? "text-amber-500"
                              : "text-gray-300"
                          }`}
                        >
                          {dayTaken}/{totalCount}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct === 100 ? "bg-emerald-400" : pct > 0 ? "bg-amber-400" : "bg-gray-200"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Medication Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-50">
              <div>
                <h2 className="text-base font-black text-gray-900">Add Medication</h2>
                <p className="text-xs text-gray-400 mt-0.5">Saved to your account</p>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">
                  Medication Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Prenatal Vitamin"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">
                    Dose *
                  </label>
                  <input
                    type="text"
                    value={form.dose}
                    onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
                    placeholder="e.g. 1 Tablet / 65 mg"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                >
                  <option>Supplement</option>
                  <option>Prescription</option>
                  <option>Vitamin</option>
                  <option>Mineral</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={`w-8 h-8 rounded-full ${c.dot} transition-all ${
                        form.color === c.value
                          ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                          : "opacity-50 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Warning if no tables yet */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                  Requires the <strong>medications</strong> and <strong>medication_logs</strong> tables
                  in Supabase. Run the migration SQL provided if you haven't already.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl bg-gray-900 text-white text-sm font-black hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? "Saving…" : "Add Medication"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
