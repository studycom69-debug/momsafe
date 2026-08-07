"use client"

import { useEffect, useState } from 'react'
import { 
    Activity, 
    Zap, 
    Thermometer, 
    ShieldCheck, 
    Bell,
    TrendingUp,
    ChevronRight,
    Droplets,
    Apple,
    Pill,
    ArrowUpRight,
    Stethoscope
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '@/lib/app-context'

const trendData = [
    { day: 'Mon', score: 82 },
    { day: 'Tue', score: 84 },
    { day: 'Wed', score: 80 },
    { day: 'Thu', score: 86 },
    { day: 'Fri', score: 85 },
    { day: 'Sat', score: 88 },
    { day: 'Sun', score: 91 },
]

const quickLinks = [
    { href: '/nutrition', label: 'Track Nutrition', icon: Apple, color: 'from-amber-400 to-orange-500' },
    { href: '/health-log', label: 'Log Symptoms', icon: Activity, color: 'from-blue-500 to-indigo-600' },
    { href: '/medication', label: 'Medications', icon: Pill, color: 'from-rose-400 to-pink-600' },
    { href: '/risk-history', label: 'Health Trends', icon: TrendingUp, color: 'from-violet-500 to-purple-600' },
]

export default function DashboardPage() {
    const { user } = useApp()
    const [greeting, setGreeting] = useState('Welcome back')

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting('Good morning')
        else if (hour < 18) setGreeting('Good afternoon')
        else setGreeting('Good evening')
    }, [])

    const displayName = (user as any)?.name || (user as any)?.email?.split('@')[0] || 'there'

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-600/80 mb-3">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#111827] leading-none">
                        {greeting}, {displayName}.
                    </h1>
                    <p className="text-[15px] text-gray-500 font-medium mt-3 max-w-xl">
                        Here's your pregnancy health overview for today. Everything looks on track with your journey.
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                <div className="lg:col-span-8 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-white p-10 rounded-3xl border border-emerald-100/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-105 transition-transform duration-700 pointer-events-none text-emerald-700">
                        <Activity className="w-48 h-48" />
                    </div>
                    
                    <div className="flex items-center gap-3 mb-8">
                        <span className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-[0.2em]">Overall Wellness</span>
                    </div>

                    <div className="flex items-end gap-6 mb-8">
                        <h2 className="text-8xl font-bold text-emerald-700 tracking-tighter leading-none">91</h2>
                        <div className="pb-2 space-y-1">
                            <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">
                                Looking good
                            </span>
                            <p className="text-[13px] text-emerald-700/60 font-medium">+9 points this week</p>
                        </div>
                    </div>

                    <p className="text-[14px] text-emerald-900/70 font-medium leading-relaxed max-w-xl">
                        Your health metrics are trending positively. Keep up the great work staying on top of your daily routine.
                    </p>
                </div>

                <div className="lg:col-span-4 bg-white p-10 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center group">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                         <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Care Status</h3>
                    <p className="text-3xl font-bold text-[#111827] tracking-tight">Protected</p>
                    <div className="mt-6 flex items-center gap-2 px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">All Systems Active</span>
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-[#111827] uppercase tracking-widest">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {quickLinks.map((item) => (
                        <Link key={item.href} href={item.href}>
                            <motion.div
                                whileHover={{ y: -4 }}
                                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 group cursor-pointer"
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-4 shadow-md group-hover:scale-110 transition-transform",
                                    item.color
                                )}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <p className="text-[12px] font-bold text-[#111827] tracking-tight leading-tight">{item.label}</p>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xl font-bold text-[#111827] tracking-tight">Wellness Trend</h3>
                            <p className="text-xs text-gray-400 font-medium mt-1">Your 7-day progress overview</p>
                        </div>
                        <Button variant="ghost" className="bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold text-[10px] rounded-xl px-4 py-3 uppercase tracking-widest transition-all">
                            Details <ArrowUpRight className="ml-1 w-3 h-3" />
                        </Button>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f3f4f6" />
                                <XAxis 
                                    dataKey="day" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 500}}
                                    dy={15}
                                />
                                <YAxis hide domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 600, fontSize: '12px' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke="#059669" 
                                    strokeWidth={2}
                                    fillOpacity={0.08} 
                                    fill="#059669" 
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-white p-10 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-sm font-bold text-[#111827] uppercase tracking-widest">Today's Reminders</h3>
                        <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                            <Bell className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="space-y-5 flex-1">
                        <Link href="/medication" className="group block cursor-default border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                            <div className="flex gap-4 items-start">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <Pill className="w-4 h-4" />
                                </div>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-[#111827] tracking-tight truncate">Prenatal Vitamin</p>
                                        <span className="text-[10px] font-bold text-gray-300 whitespace-nowrap">8:00 AM</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed">Take 1 tablet with breakfast</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/nutrition" className="group block cursor-default border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                            <div className="flex gap-4 items-start">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                                    <Apple className="w-4 h-4" />
                                </div>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-[#111827] tracking-tight truncate">Hydration Check</p>
                                        <span className="text-[10px] font-bold text-gray-300 whitespace-nowrap">Daily</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed">Drink 2.5L water today</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/ai-companion" className="group block cursor-default border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                            <div className="flex gap-4 items-start">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                    <Stethoscope className="w-4 h-4" />
                                </div>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-[#111827] tracking-tight truncate">Daily Check-in</p>
                                        <span className="text-[10px] font-bold text-gray-300 whitespace-nowrap">Now</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed">Log how you're feeling today</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                    <Link href="/alerts">
                        <button className="w-full mt-8 text-[10px] font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-[0.2em] text-center">
                            View All Reminders <ChevronRight className="inline w-3 h-3" />
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
