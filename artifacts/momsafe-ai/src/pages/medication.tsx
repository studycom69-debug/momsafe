import { useState } from "react";
import { Pill, Check, X, Bell, Clock, ChevronRight, Plus } from "lucide-react";
import { medications } from "@/lib/mock-data";

const history = [
  { date: "Mar 18", meds: [{ name: "Prenatal Vitamin", taken: true }, { name: "Iron", taken: true }, { name: "Calcium+D3", taken: false }] },
  { date: "Mar 17", meds: [{ name: "Prenatal Vitamin", taken: true }, { name: "Iron", taken: false }, { name: "Calcium+D3", taken: true }] },
  { date: "Mar 16", meds: [{ name: "Prenatal Vitamin", taken: true }, { name: "Iron", taken: true }, { name: "Calcium+D3", taken: true }] },
];

const schedule = [
  { time: "8:00 AM", meds: ["Prenatal Vitamin"] },
  { time: "2:00 PM", meds: ["Iron Supplement"] },
  { time: "6:00 PM", meds: [] },
  { time: "8:00 PM", meds: ["Calcium + D3"] },
];

export default function Medication() {
  const [taken, setTaken] = useState<number[]>([2]);
  const toggleTaken = (id: number) => setTaken(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const adherencePct = Math.round((taken.length / medications.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Medication Manager</h1>
          <p className="page-subtitle">Track prescriptions, supplements, and daily adherence.</p>
        </div>
        <div className="flex gap-2">
          <button className="ghost-btn"><Bell className="w-4 h-4" /> Set Reminder</button>
          <button className="action-btn"><Plus className="w-4 h-4" /> Add Medication</button>
        </div>
      </div>

      {/* Adherence + today overview */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4 card-hover text-center">
          <p className="text-xs text-gray-400 mb-1">Today's Adherence</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{adherencePct}%</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${adherencePct}%` }} />
          </div>
        </div>
        <div className="card p-4 card-hover text-center">
          <p className="text-xs text-gray-400 mb-1">Taken Today</p>
          <p className="text-3xl font-bold text-emerald-600 tabular-nums">{taken.length}</p>
          <p className="text-xs text-gray-400 mt-1">of {medications.length}</p>
        </div>
        <div className="card p-4 card-hover text-center">
          <p className="text-xs text-gray-400 mb-1">Pending</p>
          <p className="text-3xl font-bold text-amber-500 tabular-nums">{medications.length - taken.length}</p>
          <p className="text-xs text-gray-400 mt-1">remaining</p>
        </div>
        <div className="card p-4 card-hover text-center">
          <p className="text-xs text-gray-400 mb-1">7-Day Streak</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">5</p>
          <p className="text-xs text-emerald-500 mt-1">days ↑</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Medication cards */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Today's Medications</h2>
          {medications.map(med => {
            const isTaken = taken.includes(med.id);
            return (
              <div key={med.id} className={`card p-4 card-hover border-l-4 ${isTaken ? "border-l-emerald-400" : "border-l-gray-200"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isTaken ? "bg-emerald-100" : "bg-gray-100"}`}>
                    <Pill className={`w-5 h-5 ${isTaken ? "text-emerald-600" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{med.name}</p>
                      <span className="badge-gray text-[10px]">{med.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Pill className="w-3 h-3" />{med.dose}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{med.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTaken ? (
                      <span className="badge-green">Taken</span>
                    ) : (
                      <span className="badge-yellow">Pending</span>
                    )}
                    <button onClick={() => toggleTaken(med.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${isTaken ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                      {isTaken ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Schedule + history */}
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Daily Schedule</h2>
            <div className="space-y-2">
              {schedule.map((slot, i) => (
                <div key={slot.time} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-400 font-mono w-14">{slot.time}</span>
                    {i < schedule.length - 1 && <div className="w-px h-6 bg-gray-100 mt-1 mx-auto" style={{ marginLeft: 27 }} />}
                  </div>
                  <div className="flex-1">
                    {slot.meds.length > 0 ? (
                      slot.meds.map(m => (
                        <div key={m} className="text-xs font-medium text-gray-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">{m}</div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-300 italic">No medications</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent History</h2>
            <div className="space-y-3">
              {history.map(day => {
                const dayTaken = day.meds.filter(m => m.taken).length;
                return (
                  <div key={day.date} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-600">{day.date}</span>
                      <span className={`text-xs font-semibold ${dayTaken === 3 ? "text-emerald-600" : "text-amber-500"}`}>{dayTaken}/{day.meds.length}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {day.meds.map(m => (
                        <div key={m.name} className={`w-2 h-2 rounded-full ${m.taken ? "bg-emerald-400" : "bg-red-300"}`} title={m.name} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
