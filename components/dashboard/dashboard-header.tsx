"use client"

import { useApp } from "@/lib/app-context"
import { Search, Bell, Settings, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function DashboardHeader() {
  const { user } = useApp()
  
  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-gray-100 bg-white grow-0 shrink-0 z-40">
      <div className="flex-1 max-w-xl relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-gray-500 transition-colors" />
        <Input 
          placeholder="Search your health records, notes, or results..." 
          className="pl-10 h-10 bg-gray-50/50 border-transparent focus:bg-white focus:border-gray-100 rounded-xl text-sm placeholder:text-gray-300 transition-all"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 mr-2">
            <button className="w-10 h-10 rounded-xl hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                <Bell className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-xl hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all">
                <Settings className="w-5 h-5" />
            </button>
        </div>

        <div className="h-8 w-px bg-gray-100 mx-2" />

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-[#111827] tracking-tight truncate leading-none mb-0.5">
              {(user as any)?.name || (user as any)?.email?.split('@')[0] || "Guest"}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Health Dashboard</p>
          </div>
          <Avatar className="w-9 h-9 border border-gray-100 shadow-sm">
            <AvatarFallback className="bg-gray-50 text-gray-400 text-xs font-bold uppercase">
              {((user as any)?.name?.[0] || (user as any)?.email?.[0] || 'U')}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
