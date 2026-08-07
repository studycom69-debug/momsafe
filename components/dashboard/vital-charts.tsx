"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Activity, Heart, Calendar, Activity as PulseIcon } from "lucide-react"

const bpData = [
  { time: "00:00", systolic: 118, diastolic: 75 },
  { time: "04:00", systolic: 115, diastolic: 73 },
  { time: "08:00", systolic: 122, diastolic: 78 },
  { time: "12:00", systolic: 120, diastolic: 76 },
  { time: "16:00", systolic: 119, diastolic: 75 },
  { time: "20:00", systolic: 121, diastolic: 77 },
  { time: "24:00", systolic: 118, diastolic: 74 },
]

const hrData = [
  { time: "00:00", hr: 72 },
  { time: "04:00", hr: 68 },
  { time: "08:00", hr: 75 },
  { time: "12:00", hr: 78 },
  { time: "16:00", hr: 74 },
  { time: "20:00", hr: 76 },
  { time: "24:00", hr: 72 },
]

export function VitalCharts() {
  const [timeRange, setTimeRange] = useState("24h")

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* ── BLOOD PRESSURE ARCHITECTURE ── */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glassmorphism p-10 rounded-[48px] border border-slate-100 shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 group-hover:rotate-45 transition-transform duration-[4s]">
            <Activity className="w-64 h-64 text-blue-600" />
        </div>

        <div className="relative z-10 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-100">
                    <PulseIcon className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 tracking-tighter">Blood Pressure Matrix</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Systolic/Diastolic Variance</p>
                </div>
            </div>
            
            <div className="flex gap-1.5 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-100 w-fit">
              {["6h", "12h", "24h"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    timeRange === range ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bpData}>
                <defs>
                  <linearGradient id="colorSystolic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                    dy={15}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                    dx={-10}
                />
                <Tooltip content={<CustomTooltip label="Pressure" />} />
                <Area
                  type="monotone"
                  dataKey="systolic"
                  stroke="#3b82f6"
                  strokeWidth={4}
                  fill="url(#colorSystolic)"
                  dot={{ r: 4, fill: "#fff", stroke: "#3b82f6", strokeWidth: 2 }}
                />
                <Line 
                    type="monotone" 
                    dataKey="diastolic" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: "#fff", stroke: "#10b981", strokeWidth: 2 }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Systolic Reading</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diastolic Reading</span>
                </div>
          </div>
        </div>
      </motion.div>

      {/* ── HEART RATE VARIABILITY ── */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glassmorphism p-10 rounded-[48px] border border-slate-100 shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 group-hover:-rotate-45 transition-transform duration-[4s]">
            <Heart className="w-64 h-64 text-rose-600" />
        </div>

        <div className="relative z-10 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
                    <Activity className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 tracking-tighter">Heart Rate Dynamics</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Cross-Temporal HRV Index</p>
                </div>
            </div>
            
            <div className="flex gap-1.5 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-100 w-fit">
              {["6h", "12h", "24h"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    timeRange === range ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hrData}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                    dy={15}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                    domain={[60, 85]}
                    dx={-10}
                />
                <Tooltip content={<CustomTooltip label="BPM" />} />
                <Area
                  type="monotone"
                  dataKey="hr"
                  stroke="#10b981"
                  strokeWidth={4}
                  fill="url(#colorHr)"
                  dot={{ r: 6, fill: "#fff", stroke: "#10b981", strokeWidth: 3 }}
                  activeDot={{ r: 10, fill: "#10b981", stroke: "#fff", strokeWidth: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center justify-between w-full px-2">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observational Window: 24h</span>
                    </div>
                    <Badge variant="outline" className="border-emerald-100 bg-emerald-50/50 text-emerald-600 font-black text-[9px] uppercase tracking-widest">Real-time Link Active</Badge>
                </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function CustomTooltip({ active, payload, label: toolLabel }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="glassmorphism p-6 rounded-3xl border-slate-200 shadow-2xl bg-white/95 backdrop-blur-xl">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">{payload[0].payload.time}</p>
                <div className="space-y-3">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{entry.name}</span>
                            <span className="text-sm font-black text-slate-900">{entry.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    return null
}

function Badge({ children, className, variant }: any) {
    return (
        <span className={cn(
            "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
            className
        )}>
            {children}
        </span>
    )
}
