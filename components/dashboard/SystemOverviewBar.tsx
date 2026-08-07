"use client"

import { motion } from "framer-motion"
import { Users, AlertCircle, TrendingUp, Minus, Shield } from "lucide-react"
import type { Patient } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface SystemOverviewBarProps {
    patients: Patient[]
}

const riskConfig = {
    CRITICAL: {
        label: "Critical",
        color: "text-rose-500",
        bg: "bg-rose-50/50",
        dot: "bg-rose-500",
    },
    HIGH: {
        label: "High Risk",
        color: "text-orange-500",
        bg: "bg-orange-50/50",
        dot: "bg-orange-500",
    },
    MODERATE: {
        label: "Moderate",
        color: "text-amber-500",
        bg: "bg-amber-50/50",
        dot: "bg-amber-500",
    },
    LOW: {
        label: "Optimal",
        color: "text-emerald-500",
        bg: "bg-emerald-50/50",
        dot: "bg-emerald-500",
    },
}

function AnimatedNumber({ value }: { value: number }) {
    return (
        <motion.span
            key={value}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black tracking-tighter tabular-nums text-slate-900"
        >
            {value}
        </motion.span>
    )
}

export function SystemOverviewBar({ patients }: SystemOverviewBarProps) {
    const counts = {
        total: patients.length,
        CRITICAL: patients.filter((p) => p.riskLevel === "CRITICAL").length,
        HIGH: patients.filter((p) => p.riskLevel === "HIGH").length,
        MODERATE: patients.filter((p) => p.riskLevel === "MODERATE").length,
        LOW: patients.filter((p) => p.riskLevel === "LOW").length,
    }

    const cards = [
        {
            label: "Total Cohort",
            value: counts.total,
            Icon: Users,
            color: "text-blue-500",
            bg: "bg-blue-50/50"
        },
        {
            value: counts.CRITICAL,
            Icon: AlertCircle,
            ...riskConfig.CRITICAL,
        },
        {
            value: counts.HIGH,
            Icon: TrendingUp,
            ...riskConfig.HIGH,
        },
        {
            value: counts.MODERATE,
            Icon: Minus,
            ...riskConfig.MODERATE,
        },
        {
            value: counts.LOW,
            Icon: Shield,
            ...riskConfig.LOW,
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {cards.map((card, i) => (
                <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgb(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group"
                >
                    <div className={cn("p-2.5 rounded-xl mb-4 w-fit transition-transform group-hover:scale-110", card.bg, card.color)}>
                        <card.Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="space-y-0.5">
                        <AnimatedNumber value={card.value} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {card.label}
                        </p>
                    </div>

                    {card.label === "Critical" && card.value > 0 && (
                        <div className="absolute top-6 right-6">
                            <span className="flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    )
}
