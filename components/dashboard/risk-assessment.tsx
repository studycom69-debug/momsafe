"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp, Activity, Loader2, Sparkles, Shield, ChevronRight } from "lucide-react"
import type { Patient } from "@/lib/mock-data"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface RiskAssessmentProps {
  patient: Patient
}

export function RiskAssessment({ patient }: RiskAssessmentProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

  const riskScore =
    patient.riskLevel === "LOW" ? 28 : 
    patient.riskLevel === "MODERATE" ? 54 : 
    patient.riskLevel === "HIGH" ? 78 : 94

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setShowAnalysis(true)
    setAiAnalysis(null)

    try {
      const response = await fetch("/api/ai/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientData: patient }),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      setAiAnalysis(data.analysis)
    } catch (error) {
      console.error("[v0] Risk assessment error:", error)
      setAiAnalysis("Error: Internal neural synthesis failure. Please re-run coordinate check.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getStatusColor = () => {
      if (patient.riskLevel === 'LOW') return 'text-emerald-500'
      if (patient.riskLevel === 'MODERATE') return 'text-amber-500'
      return 'text-rose-600'
  }

  const getStrokeColor = () => {
      if (patient.riskLevel === 'LOW') return '#10b981'
      if (patient.riskLevel === 'MODERATE') return '#f59e0b'
      return '#e11d48'
  }

  return (
    <div className="glassmorphism p-10 rounded-[48px] border border-slate-100 shadow-2xl flex flex-col h-full relative overflow-hidden group">
      {/* Dynamic Glow */}
      <div className={cn(
        "absolute -top-32 -right-32 w-80 h-80 blur-[100px] opacity-10 rounded-full transition-all duration-1000",
        patient.riskLevel === "LOW" ? "bg-emerald-400" : 
        patient.riskLevel === "MODERATE" ? "bg-amber-400" : "bg-rose-400"
      )} />

      <div className="relative flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">AI Risk Synthesis</h3>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neural Sentinel Active</p>
                </div>
            </div>
        </div>
        <Button 
          onClick={handleAnalyze} 
          disabled={isAnalyzing} 
          variant="outline"
          className="rounded-2xl border-slate-200 text-slate-900 font-black text-[10px] uppercase tracking-widest px-6 h-12 shadow-sm hover:bg-slate-50 transition-all gap-3 bg-white"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Sparkles className="w-4 h-4 text-blue-600" />}
          {isAnalyzing ? "Synthesizing..." : "Deep Assessment"}
        </Button>
      </div>

      <div className="relative flex-1 space-y-12">
        <div className="flex flex-col xl:flex-row items-center gap-14">
          {/* Enhanced Risk Meter */}
          <div className="relative w-56 h-56 shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle cx="112" cy="112" r="100" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
              <motion.circle
                cx="112"
                cy="112"
                r="100"
                fill="none"
                stroke={getStrokeColor()}
                strokeWidth="12"
                strokeDasharray={628.3}
                initial={{ strokeDashoffset: 628.3 }}
                animate={{ strokeDashoffset: 628.3 - (628.3 * riskScore) / 100 }}
                transition={{ duration: 2, ease: "circOut" }}
                strokeLinecap="round"
                className="drop-shadow-[0_0_12px_rgba(0,0,0,0.05)]"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-7xl font-black tracking-tighter text-slate-900">{riskScore}</span>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Criticality</span>
            </div>
          </div>

          <div className="flex-1 space-y-8 w-full">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100/50 hover:bg-white transition-colors">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Phase Status</p>
                <div className={cn("text-lg font-black tracking-tight", getStatusColor())}>
                  {patient.riskLevel}
                </div>
              </div>
              <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100/50 hover:bg-white transition-colors">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">AI Precision</p>
                <div className="text-lg font-black text-blue-600 tracking-tight">94.8% Match</div>
              </div>
            </div>
            
            <div className="p-8 rounded-[32px] bg-slate-900 border border-slate-800 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                  <Activity className="w-16 h-16 text-white" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-4 h-4 text-blue-400" />
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Primary Insight Trace</p>
              </div>
              <p className="text-sm font-bold text-slate-300 leading-relaxed italic border-l-2 border-blue-500/30 pl-6">
                "{patient.aiReason}"
              </p>
            </div>
          </div>
        </div>

        {/* Action Badge Matrix */}
        <div className="flex flex-wrap gap-3 pt-6">
          {["Gestational Sync", "Temporal Shift", "Biometric Weighting"].map((tag) => (
              <Badge key={tag} variant="outline" className="rounded-full px-5 py-2 text-[9px] font-black uppercase tracking-widest border-slate-100 bg-white text-slate-400 shadow-sm hover:border-blue-200 transition-colors">
                  {tag}
              </Badge>
          ))}
        </div>

        <AnimatePresence>
            {showAnalysis && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-10 border-t border-slate-100 overflow-hidden"
            >
                <div className="p-8 rounded-[40px] bg-indigo-50/30 border border-indigo-100 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Deep Clinical Evidence Matrix</h4>
                </div>
                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Synthesizing deep clinical report...</p>
                    </div>
                ) : (
                    <div className="text-sm font-bold text-slate-600 leading-relaxed italic pr-6 whitespace-pre-wrap">
                    {aiAnalysis}
                    </div>
                )}
                </div>
            </motion.div>
            )}
        </AnimatePresence>

        <Button 
          variant="ghost" 
          className="w-full text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-600 transition-colors py-8 h-auto bg-slate-50/50 rounded-[24px] group"
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          {showAnalysis ? "Collapse Evidence Matrix" : "Deploy Full Clinical Evidence Matrix"}
          <ChevronRight className={cn("w-4 h-4 ml-3 transition-transform duration-500", showAnalysis ? "rotate-90 text-blue-600" : "group-hover:translate-x-1")} />
        </Button>
      </div>
    </div>
  )
}
