"use client"

import { motion } from "framer-motion"
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface VitalCardProps {
  icon: LucideIcon
  label: string
  value: string
  status: "normal" | "warning" | "critical"
  trend: string
  animated?: boolean
  color?: "primary" | "accent" | "success" | "warning" | "destructive"
}

export function VitalCard({ icon: Icon, label, value, status, trend, animated, color = "primary" }: VitalCardProps) {
  const getTheme = () => {
    switch (color) {
      case "destructive": return { text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", highlight: "bg-rose-500" }
      case "accent": return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", highlight: "bg-emerald-500" }
      case "success": return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", highlight: "bg-emerald-500" }
      case "warning": return { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", highlight: "bg-amber-500" }
      default: return { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", highlight: "bg-blue-600" }
    }
  }

  const theme = getTheme()

  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      className="glassmorphism p-8 rounded-[40px] border border-slate-100 shadow-2xl group relative overflow-hidden"
    >
      {/* Dynamic Spectrum Highlight */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1.5 transition-all duration-500 opacity-20 group-hover:opacity-100",
        theme.highlight
      )} />

      <div className="space-y-8 relative z-10">
        <div className="flex items-center justify-between">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 shadow-inner border",
            theme.text, theme.bg, theme.border
          )}>
            <Icon className={cn("w-7 h-7", animated && "animate-pulse")} />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  status === "normal" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                  status === "warning" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                  "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)] animate-pulse"
                )} />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{status}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-60">{label}</p>
          <p className="text-4xl font-black tracking-tighter text-slate-900 group-hover:scale-105 transition-transform origin-left duration-500">{value}</p>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {trend.startsWith("+") ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : 
             trend.startsWith("-") ? <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> : 
             <Minus className="w-3.5 h-3.5 text-slate-300" />}
            <span className={cn(
                "text-[10px] font-black uppercase tracking-wider",
                trend.startsWith("+") ? "text-emerald-600" : 
                trend.startsWith("-") ? "text-rose-600" : "text-slate-400"
            )}>
                {trend}
            </span>
          </div>
          <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">vs 24h interval</span>
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute -bottom-6 -right-6 p-12 opacity-[0.03] group-hover:scale-125 transition-transform duration-[4s] rotate-12">
          <Icon className="w-24 h-24" />
      </div>
    </motion.div>
  )
}
