"use client"

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
    Bell,
    AlertTriangle,
    CheckCircle2,
    ShieldAlert,
    Droplets,
    Pill,
    Heart,
    Moon,
    Phone,
    ChevronRight,
    Clock,
    Settings,
    Volume2,
    Users,
    MapPin
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertItem {
    id: string
    type: 'urgent' | 'warning' | 'info' | 'success'
    icon: any
    iconColor: string
    iconBg: string
    title: string
    description: string
    time: string
    status: 'new' | 'read' | 'acknowledged'
    category: string
    action?: string
}

const alerts: AlertItem[] = [
    {
        id: '1',
        type: 'info',
        icon: Droplets,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-500/10',
        title: 'Hydration Reminder',
        description: "You've had 1.8L of 2.5L today. Time for a glass of water to stay on track.",
        time: '5 min ago',
        status: 'new',
        category: 'Wellness',
        action: 'Log Water'
    },
    {
        id: '2',
        type: 'info',
        icon: Pill,
        iconColor: 'text-violet-600',
        iconBg: 'bg-violet-500/10',
        title: 'Medication Due: Folic Acid',
        description: 'Scheduled dose: 400 mcg. Confirm when taken to keep your log accurate.',
        time: '12 min ago',
        status: 'new',
        category: 'Medication',
        action: 'Confirm Taken'
    },
    {
        id: '3',
        type: 'success',
        icon: Heart,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-500/10',
        title: 'Vitals Check Passed',
        description: 'Heart rate 72 BPM, BP 118/76 mmHg. All within optimal range.',
        time: '1 hour ago',
        status: 'read',
        category: 'Monitoring'
    },
    {
        id: '4',
        type: 'warning',
        icon: Moon,
        iconColor: 'text-amber-600',
        iconBg: 'bg-amber-500/10',
        title: 'Sleep Quality Dip',
        description: 'Last night\'s rest was 6h 15m vs target 8h. Consider a 20-min nap today.',
        time: '3 hours ago',
        status: 'read',
        category: 'Sleep',
        action: 'Schedule Nap'
    },
    {
        id: '5',
        type: 'urgent',
        icon: ShieldAlert,
        iconColor: 'text-rose-600',
        iconBg: 'bg-rose-500/10',
        title: 'Family Alert: Contraction Pattern',
        description: 'Irregular contractions detected. Your partner has been notified via SMS.',
        time: 'Yesterday',
        status: 'acknowledged',
        category: 'Emergency',
        action: 'View Details'
    },
]

const emergencyContacts = [
    { name: "Dr. Sarah Chen", role: "OB-GYN", phone: "(555) 012-3456", type: "Primary" },
    { name: "Michael Carter", role: "Partner", phone: "(555) 789-0123", type: "Emergency" },
    { name: "St. Mary's Hospital", role: "Maternity Ward", phone: "(555) 456-7890", type: "Facility" },
]

export default function AlertsPage() {
    const [filter, setFilter] = useState<string>('All')
    const filters = ['All', 'Urgent', 'Medication', 'Wellness', 'Monitoring']

    const filtered = filter === 'All' ? alerts : alerts.filter(a =>
        filter === 'Urgent' ? a.type === 'urgent' || a.type === 'warning' : a.category === filter
    )

    const stats = [
        { label: 'Active Alerts', value: alerts.filter(a => a.status === 'new').length, color: 'from-rose-500 to-pink-500', icon: Bell },
        { label: 'Acknowledged', value: alerts.filter(a => a.status === 'acknowledged').length, color: 'from-emerald-500 to-teal-500', icon: CheckCircle2 },
        { label: 'Family Notified', value: 2, color: 'from-blue-500 to-indigo-500', icon: Users },
    ]

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-black text-foreground tracking-tighter">Alerts Center</h1>
                            <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-black text-[10px] tracking-widest px-4 py-1.5 uppercase rounded-full">
                                {alerts.filter(a => a.status === 'new').length} New
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium mt-1">Real-time notifications and emergency response coordination.</p>
                    </div>
                    <Button variant="outline" className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2 border-border/50">
                        <Settings className="w-4 h-4" /> Alert Settings
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.map((s, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="glassmorphism p-8 rounded-[40px] border border-border/50 relative overflow-hidden group"
                        >
                            <div className={cn("absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-20 bg-gradient-to-br", s.color)} />
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-70">{s.label}</p>
                                    <p className="text-5xl font-black text-foreground tracking-tighter leading-none">{s.value}</p>
                                </div>
                                <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-xl", s.color)}>
                                    <s.icon className="w-7 h-7" />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {filters.map((f, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setFilter(f)}
                                        className={cn(
                                            "shrink-0 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                                            filter === f
                                                ? "bg-foreground text-background shadow-lg"
                                                : "bg-white/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-white"
                                        )}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-70">
                                <Volume2 className="w-3.5 h-3.5" /> Sound: On
                            </div>
                        </div>

                        <div className="space-y-4">
                            {filtered.map((alert, i) => (
                                <motion.div
                                    key={alert.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={cn(
                                        "glassmorphism p-8 rounded-[40px] border transition-all group hover:shadow-xl",
                                        alert.type === 'urgent' && "border-rose-500/30 bg-rose-500/[0.02]",
                                        alert.status === 'new' && "ring-2 ring-primary/10 ring-offset-0"
                                    )}
                                >
                                    <div className="flex gap-6 items-start">
                                        <div className={cn(
                                            "w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 shadow-md",
                                            alert.iconBg, alert.iconColor
                                        )}>
                                            <alert.icon className="w-7 h-7" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1.5 min-w-0">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h4 className="text-lg font-black text-foreground tracking-tight truncate">{alert.title}</h4>
                                                        {alert.status === 'new' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> New
                                                            </span>
                                                        )}
                                                        {alert.type === 'urgent' && (
                                                            <Badge className="bg-rose-500 text-white border-0 text-[9px] font-black uppercase tracking-widest rounded-full px-3">
                                                                <AlertTriangle className="w-3 h-3 mr-1" /> Urgent
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{alert.description}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">{alert.time}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-2">
                                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border/40 text-muted-foreground rounded-full px-3 py-1">
                                                    {alert.category}
                                                </Badge>
                                                {alert.action && (
                                                    <Button size="sm" className={cn(
                                                        "h-10 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest",
                                                        alert.type === 'urgent' && "bg-rose-600 hover:bg-rose-700 text-white"
                                                    )}>
                                                        {alert.action} <ChevronRight className="w-3 h-3 ml-1" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <div className="p-10 rounded-[48px] bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-[0_40px_80px_-20px_rgba(244,63,94,0.4)] overflow-hidden relative group">
                            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
                            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="w-14 h-14 rounded-[20px] bg-white/15 border border-white/20 backdrop-blur flex items-center justify-center">
                                        <Phone className="w-7 h-7" />
                                    </div>
                                    <div className="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Ready</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black tracking-tighter leading-tight">Emergency SOS</h3>
                                    <p className="text-sm font-semibold text-white/70 leading-relaxed">
                                        One tap to alert emergency services, your care team, and all trusted contacts simultaneously.
                                    </p>
                                </div>
                                <Button className="w-full h-16 rounded-[24px] bg-white text-rose-600 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-white/90 shadow-2xl">
                                    <ShieldAlert className="w-5 h-5 mr-2" /> Activate SOS
                                </Button>
                            </div>
                        </div>

                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Trusted Contacts</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Auto-notified on alerts</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {emergencyContacts.map((c, i) => (
                                    <div key={i} className="p-5 rounded-[28px] bg-white/70 border border-border/40 hover:shadow-lg hover:scale-[1.01] transition-all group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="font-black text-foreground tracking-tight">{c.name}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{c.role}</p>
                                            </div>
                                            <Badge className={cn(
                                                "text-[9px] font-black uppercase tracking-widest rounded-full px-3",
                                                c.type === 'Emergency' ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                                                c.type === 'Primary' ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                                                "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                            )}>
                                                {c.type}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-muted-foreground tracking-tight flex items-center gap-2">
                                                <Phone className="w-3.5 h-3.5" /> {c.phone}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                                Call
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" className="w-full h-12 rounded-2xl border-dashed border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
                                <MapPin className="w-4 h-4 mr-2" /> Add Hospital Address
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
