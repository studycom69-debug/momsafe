"use client"

import React from "react"
import { CheckCircle, Clock } from "lucide-react"

export function AlertsTimeline({ alerts }: { alerts?: any[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Recent Alerts</h3>
        <span className="text-xs text-slate-400 font-medium">Real-time biometrics</span>
      </div>
      <div className="space-y-3">
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs font-bold text-emerald-900">Vitals Normal</div>
              <div className="text-[10px] text-emerald-700">BP and HR within target parameters.</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-600">10m ago</span>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-xs font-bold text-blue-900">Hydration Reminder</div>
              <div className="text-[10px] text-blue-700">1 glass of water logged. Goal: 2.5L</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-blue-600">1h ago</span>
        </div>
      </div>
    </div>
  )
}
