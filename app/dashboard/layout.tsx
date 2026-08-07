"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { 
  Activity, 
  LayoutDashboard, 
  Apple, 
  ClipboardList, 
  Pill, 
  BarChart3,
  ChevronRight,
  Settings,
  LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useApp } from "@/lib/app-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { motion, AnimatePresence } from "framer-motion"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Apple, label: "Nutrition & Diet", href: "/nutrition" },
  { icon: ClipboardList, label: "Daily Logs", href: "/health-log" },
  { icon: Pill, label: "Medications", href: "/medication" },
  { icon: BarChart3, label: "Health Trends", href: "/risk-history" },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useApp()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !user) {
      router.push("/login")
    }
  }, [user, mounted, router])

  if (!mounted) return null

  const displayName = (user as any)?.name || (user as any)?.email?.split('@')[0] || "User"
  const displayInitial = displayName?.[0]?.toUpperCase() || "U"

  return (
    <div className="h-screen flex bg-white overflow-hidden selection:bg-primary/10">
      <aside className={cn(
        "h-full bg-white border-r border-gray-100 flex flex-col transition-all duration-500 ease-in-out z-50 shrink-0",
        isSidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="h-20 flex items-center px-6 shrink-0 justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white transition-all group-hover:scale-110 shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col"
              >
                <span className="text-lg font-bold tracking-tight text-[#111827]">MomSafe</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Premium Care</span>
              </motion.div>
            )}
          </div>
          {isSidebarOpen && user && (
            <button 
              onClick={() => signOut()}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-1 custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all group cursor-pointer relative mb-1",
                  isActive 
                    ? "bg-[#111827] text-white shadow-xl shadow-gray-200" 
                    : "text-gray-400 hover:bg-gray-50 hover:text-[#111827]"
                )}>
                  <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-white" : "group-hover:text-[#111827]")} />
                  {isSidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-bold tracking-tight"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && isSidebarOpen && (
                    <motion.div 
                      layoutId="nav-active-dot"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" 
                    />
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-50 bg-gray-50/30 space-y-3">
          <div className={cn(
            "w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm group",
            !isSidebarOpen && "justify-center"
          )}>
            <Avatar className="w-10 h-10 border border-gray-50 shadow-sm">
              <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold text-xs uppercase">
                {displayInitial}
              </AvatarFallback>
            </Avatar>
            {isSidebarOpen && (
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-bold text-[#111827] truncate uppercase tracking-tighter">{displayName}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  MomSafe User
                </p>
              </div>
            )}
            {isSidebarOpen && (
              <Link href="/dashboard">
                <Settings className="w-4 h-4 text-gray-300 hover:text-blue-500 transition-colors" />
              </Link>
            )}
          </div>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-xl text-gray-400 hover:bg-white hover:text-[#111827] transition-all border border-transparent hover:border-gray-100"
          >
            {isSidebarOpen ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F9FAFB]">
        <DashboardHeader />
        
        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none opacity-30" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-w-7xl mx-auto py-12 px-12 relative"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
