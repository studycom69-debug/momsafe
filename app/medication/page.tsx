"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Pill,
    Clock,
    CheckCircle2,
    AlertCircle,
    History,
    MessageCircle,
    Phone,
    Activity,
    ChevronRight,
    Search,
    ShieldCheck,
    Calendar,
    Target,
    Zap,
    Cpu,
    Dna
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { User as SupabaseUser } from '@supabase/supabase-js'

interface Prescription {
    id: string
    medicine_name: string
    dosage: string
    frequency: string
    scheduled_times: string[]
    instructions: string
    created_at: string
}

interface MedicineLog {
    id: string
    medicine_name: string
    scheduled_time: string
    confirmed_at: string
}

interface ScheduledDose {
    id: string
    prescription_id: string
    medicine_name: string
    time: string
    status: 'TAKEN' | 'PENDING' | 'MISSED'
    confirmed_at?: string
}

export default function MedicationPage() {
    const [user, setUser] = useState<SupabaseUser | null>(null)
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [logs, setLogs] = useState<MedicineLog[]>([])
    const [schedule, setSchedule] = useState<ScheduledDose[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session) {
                console.log("No session found, using demo mode")
                const mockUser = { id: 'mock-id', user_metadata: { full_name: 'Sarah Miller' } } as any
                setUser(mockUser)
                setLoading(false)
                return
            }
            
            setUser(session.user)
            await fetchPrescriptions(session.user.id)
            await fetchLogs(session.user.id)
            setLoading(false)
        }
        fetchData()
    }, [])

    const fetchPrescriptions = async (userId: string) => {
        const { data } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        setPrescriptions(data || [])
    }

    const fetchLogs = async (userId: string) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data } = await supabase
            .from('medicine_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', today.toISOString())
            .order('confirmed_at', { ascending: false })
        setLogs(data || [])
    }

    // Generate daily schedule based on prescriptions and today's logs
    useEffect(() => {
        if (prescriptions.length === 0) return

        const dailySchedule: ScheduledDose[] = []
        const now = new Date()

        prescriptions.forEach(p => {
            p.scheduled_times.forEach(time => {
                const [hours, minutes] = time.split(':').map(Number)
                const scheduledDate = new Date()
                scheduledDate.setHours(hours, minutes, 0, 0)

                const log = logs.find(l =>
                    l.medicine_name === p.medicine_name &&
                    l.scheduled_time === time
                )

                let status: 'TAKEN' | 'PENDING' | 'MISSED' = 'PENDING'
                if (log) {
                    status = 'TAKEN'
                } else if (scheduledDate < now) {
                    status = 'MISSED'
                }

                dailySchedule.push({
                    id: `${p.id}-${time}`,
                    prescription_id: p.id,
                    medicine_name: p.medicine_name,
                    time,
                    status,
                    confirmed_at: log?.confirmed_at
                })
            })
        })

        // Sort by time
        dailySchedule.sort((a, b) => a.time.localeCompare(b.time))
        setSchedule(dailySchedule)
    }, [prescriptions, logs])

    const confirmDose = async (dose: ScheduledDose) => {
        if (!user || dose.status === 'TAKEN') return
        setSubmitting(dose.id)

        try {
            await supabase.from('medicine_logs').insert({
                user_id: user.id,
                medicine_name: dose.medicine_name,
                scheduled_time: dose.time,
                confirmed_at: new Date().toISOString()
            })

            await fetchLogs(user.id)
        } catch (error) {
            console.error('Confirm dose error:', error)
        } finally {
            setSubmitting(null)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background font-sans">
            <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin mb-6" />
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] animate-pulse">Synchronizing Neural Grid</p>
        </div>
    )

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-black text-foreground tracking-tighter">Clinical Intake</h1>
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] tracking-widest px-4 py-1.5 uppercase rounded-full">
                                Optimized Protocols
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium mt-1">Metabolic stabilization and scheduled synthesis management.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="glassmorphism p-5 rounded-[28px] border border-border/50 flex items-center gap-6 px-10">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1 opacity-60">Protocols Active</span>
                                <span className="text-xl font-black text-foreground tracking-tighter">{prescriptions.length}</span>
                            </div>
                            <div className="w-[1px] h-10 bg-border/30" />
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1 opacity-60">Doses Logged</span>
                                <span className="text-xl font-black text-success tracking-tighter">{logs.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">

                    {/* SCHEDULE & TAKING DOSES */}
                    <div className="xl:col-span-8 space-y-12">

                        {/* Daily Timeline */}
                        <div className="glassmorphism p-12 rounded-[56px] border border-border/50 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                <Calendar className="w-48 h-48 -rotate-12" />
                            </div>

                            <div className="relative z-10 space-y-10">
                                <div className="flex justify-between items-center px-4">
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Temporal Intake Cycle</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(var(--success),1)]" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Real-time Verified</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {schedule.length > 0 ? (
                                        schedule.map((dose, i) => (
                                            <motion.div
                                                key={dose.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                className={cn(
                                                    "group flex items-center gap-8 p-10 rounded-[44px] border transition-all duration-500",
                                                    dose.status === 'TAKEN'
                                                        ? "bg-success/[0.03] border-success/20 grayscale-[0.5] opacity-60"
                                                        : dose.status === 'MISSED'
                                                            ? "bg-destructive/[0.03] border-destructive/20"
                                                            : "bg-white/40 border-border/50 hover:bg-white/60 hover:shadow-2xl hover:scale-[1.01]"
                                                )}
                                            >
                                                {/* Time Badge */}
                                                <div className={cn(
                                                    "w-24 h-24 rounded-[32px] flex flex-col items-center justify-center border transition-all shadow-xl",
                                                    dose.status === 'TAKEN' ? "bg-success/10 border-success/20 text-success" :
                                                        dose.status === 'MISSED' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                                                            "bg-background border-border/50 text-foreground group-hover:border-primary/30"
                                                )}>
                                                    <Clock className="w-6 h-6 mb-2" />
                                                    <span className="text-sm font-black tracking-tighter">{dose.time}</span>
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="flex items-center gap-4">
                                                        <h4 className="text-2xl font-black text-foreground tracking-tighter truncate">{dose.medicine_name}</h4>
                                                        <Badge variant="outline" className="border-border/30 text-[9px] font-black uppercase tracking-widest px-3">
                                                            {dose.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                                                        Scheduled Metabolic Influx Point
                                                    </p>
                                                </div>

                                                <div className="shrink-0 flex items-center gap-6">
                                                    {dose.status === 'TAKEN' ? (
                                                        <div className="text-right flex flex-col items-end">
                                                            <CheckCircle2 className="w-8 h-8 text-success mb-2" />
                                                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Confirmed</span>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            onClick={() => confirmDose(dose)}
                                                            disabled={submitting === dose.id}
                                                            className={cn(
                                                                "h-16 px-12 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-2xl",
                                                                dose.status === 'MISSED'
                                                                    ? "bg-destructive text-white hover:opacity-90"
                                                                    : "bg-foreground text-background hover:bg-primary hover:text-white"
                                                            )}
                                                        >
                                                            {submitting === dose.id ? 'Syncing...' : 'Acknowledge Dose'}
                                                            <ChevronRight className="ml-3 w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center space-y-6">
                                            <div className="w-20 h-20 glassmorphism rounded-full flex items-center justify-center mx-auto opacity-20">
                                                <History className="w-10 h-10" />
                                            </div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">No Temporal Cycles Defined</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Mini Log */}
                        <div className="space-y-8">
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] px-4">Neural Compliance Logs</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {logs.slice(0, 4).map((log, i) => (
                                    <div key={log.id} className="glassmorphism p-8 rounded-[40px] border border-success/20 bg-success/[0.01] flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success shadow-lg">
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-black text-foreground text-sm tracking-tight truncate">{log.medicine_name}</h5>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Verified {log.scheduled_time}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-success uppercase tracking-widest">Protocol Met</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* SIDECAR: ACTIVE PRESCRIPTIONS */}
                    <div className="xl:col-span-4 space-y-12">

                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                <Cpu className="w-32 h-32" />
                            </div>
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] mb-10 pl-2">Active Clinical Protocols</h3>

                            <div className="space-y-8">
                                {prescriptions.map((p, i) => (
                                    <motion.div
                                        key={p.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="space-y-6 p-8 rounded-[40px] bg-muted/5 border border-border/30 hover:bg-muted/10 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <h4 className="text-xl font-black text-foreground tracking-tighter group-hover:text-primary transition-colors">{p.medicine_name}</h4>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">{p.dosage} • {p.frequency}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-2xl glassmorphism border border-border/50 flex items-center justify-center group-hover:bg-primary group-hover:text-background transition-all">
                                                <Pill className="w-5 h-5" />
                                            </div>
                                        </div>

                                        <div className="p-6 rounded-[28px] bg-background/50 border border-border/20">
                                            <p className="text-[11px] font-black text-foreground uppercase tracking-[0.1em] mb-2 opacity-40">Clinical Instruction</p>
                                            <p className="text-xs font-semibold text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-4">
                                                "{p.instructions}"
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex -space-x-3">
                                                {p.scheduled_times.map(time => (
                                                    <div key={time} className="w-10 h-10 rounded-full bg-background border-2 border-border/20 flex items-center justify-center shadow-lg relative z-0 hover:z-10 transition-all hover:scale-110">
                                                        <span className="text-[8px] font-black tracking-tighter">{time}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary">
                                                Telemetry Details <ChevronRight className="ml-1 w-3 h-3" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}

                                <Button className="w-full bg-primary/5 border-2 border-dashed border-primary/20 text-primary h-20 rounded-[32px] font-black uppercase text-[10px] tracking-[0.3em] hover:bg-primary/10 transition-all">
                                    Initialize New Deployment
                                </Button>
                            </div>
                        </div>

                        {/* DOCTOR CONNECT */}
                        <div className="p-10 rounded-[48px] bg-foreground text-background relative overflow-hidden group shadow-[0_40px_100px_rgba(0,0,0,0.15)]">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                                <ShieldCheck className="w-32 h-32" />
                            </div>
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Clinician Direct-Link</p>
                                    <h5 className="text-2xl font-black tracking-tighter leading-tight">Requirement for override or changes?</h5>
                                </div>
                                <p className="text-xs font-semibold text-background/60 leading-relaxed italic border-l-2 border-background/20 pl-6">
                                    "Consult your sentinel physician before modifying clinical intake protocols."
                                </p>
                                <div className="flex gap-4 pt-6">
                                    <Button className="flex-1 bg-background text-foreground font-black text-[9px] uppercase tracking-widest h-14 rounded-2xl hover:opacity-90">
                                        <MessageCircle className="mr-2 w-4 h-4" /> Secure Chat
                                    </Button>
                                    <Button variant="outline" className="flex-1 border-background/20 bg-transparent text-background font-black text-[9px] uppercase tracking-widest h-14 rounded-2xl hover:bg-background/10">
                                        <Phone className="mr-2 w-4 h-4" /> Voip Link
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
