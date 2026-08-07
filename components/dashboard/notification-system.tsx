"use client"

import { useState } from "react"
import { Bell, Info, AlertCircle, CheckCircle2, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: "info" | "warning" | "success" | "critical"
  title: string
  message: string
  time: string
}

export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-20 right-8 z-[100] w-80 space-y-4 pointer-events-none">
      <AnimatePresence>
        {notifications.slice(0, 3).map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="pointer-events-auto bg-white border border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.05)] rounded-2xl p-5 relative overflow-hidden group"
          >
            <div className="flex gap-4 items-start relative z-10">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110",
                n.type === "critical" ? "bg-rose-50 text-rose-500" :
                n.type === "warning" ? "bg-amber-50 text-amber-500" :
                n.type === "success" ? "bg-emerald-50 text-emerald-500" : "bg-gray-50 text-gray-400"
              )}>
                {n.type === "critical" ? <AlertCircle className="w-5 h-5" /> : 
                 n.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-[#111827] tracking-tight truncate">{n.title}</p>
                </div>
                <p className="text-[11px] text-gray-400 font-medium leading-relaxed line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mt-2">{n.time}</p>
              </div>
            </div>
            
            <button 
              onClick={() => removeNotification(n.id)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-50 text-gray-300 hover:text-gray-500 transition-all opacity-0 group-hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
