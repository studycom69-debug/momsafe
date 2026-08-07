"use client"

import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const Pulse = ({ className }: { className?: string }) => (
  <motion.div
    initial={{ opacity: 0.4 }}
    animate={{ opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    className={cn("bg-slate-200 rounded-2xl", className)}
  />
)

export function VitalCardSkeleton() {
  return (
    <div className="glassmorphism p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pulse className="w-10 h-10 rounded-xl" />
          <Pulse className="w-24 h-3" />
        </div>
        <Pulse className="w-4 h-4 rounded-full" />
      </div>
      <div className="space-y-4">
        <Pulse className="w-32 h-10" />
        <Pulse className="w-48 h-2" />
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="glassmorphism p-10 rounded-[48px] border border-slate-100 shadow-2xl space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <Pulse className="w-48 h-6" />
          <Pulse className="w-32 h-2" />
        </div>
        <div className="flex gap-2">
          <Pulse className="w-12 h-10 rounded-xl" />
          <Pulse className="w-12 h-10 rounded-xl" />
        </div>
      </div>
      <Pulse className="w-full h-64 rounded-[32px]" />
      <div className="grid grid-cols-3 gap-6">
          <Pulse className="h-16 rounded-2xl" />
          <Pulse className="h-16 rounded-2xl" />
          <Pulse className="h-16 rounded-2xl" />
      </div>
    </div>
  )
}

export function PatientCardSkeleton() {
  return (
    <div className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-sm">
      <div className="flex items-start gap-5">
        <Pulse className="w-14 h-14 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Pulse className="w-40 h-5" />
              <Pulse className="w-24 h-3" />
            </div>
            <Pulse className="w-20 h-6 rounded-full" />
          </div>
          <div className="flex items-center gap-6">
            <Pulse className="w-20 h-3" />
            <Pulse className="w-20 h-3" />
          </div>
          <Pulse className="w-full h-2 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-4">
      <Pulse className="w-10 h-10 rounded-2xl shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="p-5 rounded-[24px] bg-slate-50 border border-slate-100">
          <div className="space-y-3">
            <Pulse className="w-full h-3 bg-white" />
            <Pulse className="w-5/6 h-3 bg-white" />
            <Pulse className="w-4/6 h-3 bg-white" />
          </div>
        </div>
        <Pulse className="w-20 h-2 ml-2" />
      </div>
    </div>
  )
}
