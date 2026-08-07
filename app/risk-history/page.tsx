"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/layout/AppLayout'
import {
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Shield,
    Calendar,
    Filter,
    ArrowUpDown,
    Download,
    Layers,
    History,
    Dna
} from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface MriScoreEntry {
    id: string
    score: number
    status: string
    velocity: number
    acceleration: number
    created_at: string
}

export default function RiskHistoryPage() {
    const [user, setUser] = useState<any>(null)
    const [history, setHistory] = useState<MriScoreEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session) {
                console.log("No session found, using demo mode")
                const mockUser = { id: 'mock-id', user_metadata: { full_name: 'Sarah Miller' } } as any
                setUser(mockUser)
                setLoading(false)
                return
            }
            
            setUser(session.user)

            const { data } = await supabase
                .from('mri_scores')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })

            setHistory(data || [])
            setLoading(false)
        }
        fetchHistory()
    }, [])

    const latest = history[0];

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
            <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin mb-6" />
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] animate-pulse">Querying Neural Repository</p>
        </div>
    )

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">

                {/* Page Title */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-4xl font-black text-foreground tracking-tighter">Diagnostic Intelligence</h1>
                        <p className="text-muted-foreground font-semibold mt-1">Longitudinal biometric pattern synthesis and predictive deviation modeling.</p>
                    </motion.div>
                    <div className="flex items-center gap-5">
                        <Button variant="outline" className="rounded-2xl glassmorphism border-border/50 font-black text-[10px] uppercase tracking-widest px-8 py-7 h-auto hover:bg-muted/10">
                            <Calendar className="w-4 h-4 mr-3 opacity-60" /> Adjust Epoch
                        </Button>
                        <Button className="rounded-2xl bg-foreground text-background font-black text-[10px] uppercase tracking-widest px-10 py-7 h-auto shadow-2xl shadow-foreground/20 hover:opacity-90 transition-all">
                            <Download className="w-4 h-4 mr-3" /> Export Dataset
                        </Button>
                    </div>
                </div>

                {/* Metric Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <AnalyticsCard
                        label="Logarithmic Velocity"
                        value={latest?.velocity !== undefined ? (latest.velocity > 0 ? '+' : '') + latest.velocity.toFixed(1) : '0.0'}
                        subLabel="Flux / Epoch"
                        trend={latest?.velocity !== undefined && Math.abs(latest.velocity) > 0.1 ? (latest.velocity > 0 ? 'up' : 'down') : 'neutral'}
                        icon={Zap}
                        color={latest?.velocity !== undefined && latest.velocity > 0 ? 'destructive' : 'success'}
                    />
                    <AnalyticsCard
                        label="Neural Acceleration"
                        value={latest?.acceleration !== undefined ? (latest.acceleration > 0 ? '+' : '') + latest.acceleration.toFixed(1) : '0.0'}
                        subLabel="Δ Pattern / Δ Time"
                        trend={latest?.acceleration !== undefined && Math.abs(latest.acceleration) > 0.1 ? (latest.acceleration > 0 ? 'up' : 'down') : 'neutral'}
                        icon={Activity}
                        color={latest?.acceleration !== undefined && latest.acceleration > 0 ? 'destructive' : 'success'}
                    />
                    <AnalyticsCard
                        label="Steady State Index"
                        value={latest?.velocity && Math.abs(latest.velocity) < 2 ? 'Equilibrium' : 'Active'}
                        subLabel="Homeostatic audit"
                        trend="neutral"
                        icon={Shield}
                        color="primary"
                    />
                </div>

                {/* Risk Projection Map */}
                <div className="glassmorphism p-12 rounded-[56px] border border-border/50 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-[2s] pointer-events-none">
                        <History className="w-96 h-96 -rotate-12" />
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 mb-16 relative z-10">
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black text-foreground tracking-tighter">Progression Topology</h3>
                            <p className="text-muted-foreground font-semibold text-sm">Synthetic risk trajectory correlated across multi-modal benchmarks.</p>
                        </div>
                        <div className="flex items-center gap-8 p-6 rounded-[32px] glassmorphism border border-border/30 bg-muted/5">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <span className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">Neural Path</span>
                            </div>
                            <div className="w-[1px] h-4 bg-border/50" />
                            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10 rounded-xl px-6">
                                <Layers className="w-4 h-4 mr-3" /> Re-Fidelity
                            </Button>
                        </div>
                    </div>

                    <div className="h-[500px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[...history].reverse()}>
                                <defs>
                                    <linearGradient id="colorMri" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis
                                    dataKey="created_at"
                                    tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={10}
                                    fontWeight={900}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={10}
                                    fontWeight={900}
                                    tickLine={false}
                                    axisLine={false}
                                    hide
                                />
                                <RechartsTooltip
                                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderRadius: '24px',
                                        border: '1px solid hsl(var(--border))',
                                        boxShadow: '0 40px 60px -10px rgb(0 0 0 / 0.2)',
                                        padding: '20px'
                                    }}
                                    labelFormatter={(label) => new Date(label).toLocaleString()}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="score"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={6}
                                    fillOpacity={1}
                                    fill="url(#colorMri)"
                                    dot={{ r: 6, fill: 'hsl(var(--background))', strokeWidth: 4, stroke: 'hsl(var(--primary))' }}
                                    activeDot={{ r: 10, strokeWidth: 0, fill: 'hsl(var(--foreground))' }}
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Audit Trail Table */}
                <div className="space-y-10">
                    <div className="flex items-center gap-5 px-4">
                        <div className="p-4 rounded-2xl bg-foreground/5 text-foreground">
                            <Dna className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black text-foreground tracking-tighter uppercase tracking-[0.1em]">Longitudinal Registry</h2>
                    </div>

                    <div className="glassmorphism rounded-[48px] border border-border/50 shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border/20 bg-muted/5">
                                        <th className="py-8 px-12 text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em]">Temporal Epoch</th>
                                        <th className="py-8 px-12 text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center">Neural Index</th>
                                        <th className="py-8 px-12 text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center">Stability Vector</th>
                                        <th className="py-8 px-12 text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] text-right">Deviation Flux</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {history.map((entry) => (
                                        <tr key={entry.id} className="group hover:bg-primary/[0.02] transition-colors">
                                            <td className="py-10 px-12">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-black text-foreground tracking-tight">
                                                        {new Date(entry.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                                                        {new Date(entry.created_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-10 px-12 text-center">
                                                <div className="inline-flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-foreground tracking-tighter">{entry.score}</span>
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">MRI</span>
                                                </div>
                                            </td>
                                            <td className="py-10 px-12 text-center">
                                                <Badge className={cn(
                                                    "px-6 py-2 font-black uppercase text-[9px] tracking-[0.2em] rounded-full border-none shadow-lg",
                                                    entry.status === 'Stable' ? "bg-success text-white" :
                                                        entry.status === 'Elevated' ? "bg-amber-400 text-white" :
                                                            "bg-destructive text-white"
                                                )}>
                                                    {entry.status}
                                                </Badge>
                                            </td>
                                            <td className="py-10 px-12 text-right">
                                                <div className={cn(
                                                    "inline-flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-sm transition-all",
                                                    entry.velocity > 0 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-success/10 text-success border border-success/20"
                                                )}>
                                                    {entry.velocity > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                                    <span>{entry.velocity > 0 ? '+' : ''}{entry.velocity.toFixed(1)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}

function AnalyticsCard({ label, value, subLabel, trend, icon: Icon, color }: { label: string, value: string, subLabel: string, trend: string, icon: any, color: string }) {
    const iconColors: Record<string, string> = {
        success: "text-success bg-success/10 border-success/20",
        destructive: "text-destructive bg-destructive/10 border-destructive/20",
        warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        primary: "text-primary bg-primary/10 border-primary/20"
    }
    const colorClass = iconColors[color] || iconColors.primary;

    return (
        <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="glassmorphism p-10 rounded-[44px] border border-border/50 shadow-xl transition-all relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className={cn("p-4 rounded-2xl border", colorClass)}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend !== 'neutral' && (
                    <div className={cn(
                        "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full",
                        trend === 'up' ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                    )}>
                        {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {trend === 'up' ? 'Acceleration' : 'Regression'}
                    </div>
                )}
            </div>
            <div className="relative z-10">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-3 opacity-60">{label}</p>
                <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-foreground tracking-tighter">{value}</span>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">{subLabel}</span>
                </div>
            </div>
        </motion.div>
    )
}
