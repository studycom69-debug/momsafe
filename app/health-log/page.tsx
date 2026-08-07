"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity,
    Droplets,
    Baby,
    Smile,
    Utensils,
    Plus,
    Minus,
    ChevronRight,
    Search,
    ShieldCheck,
    AlertCircle,
    Zap,
    Cpu,
    Dna,
    Fingerprint,
    Waves
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { User as SupabaseUser } from '@supabase/supabase-js'

const SYMPTOMS = [
    'Headache', 'Blurred Vision', 'Swelling', 'Nausea',
    'Dizziness', 'Abdominal Pain', 'Bleeding', 'Reduced Fetal Movement'
]

const MOODS = [
    { emoji: '🙂', label: 'Optimal' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😔', label: 'Strained' },
    { emoji: '😣', label: 'Critical' },
    { emoji: '😴', label: 'Depleted' }
]

export default function HealthLogPage() {
    const [user, setUser] = useState<SupabaseUser | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(true)

    // Form states
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
    const [severity, setSeverity] = useState(1)
    const [fetalMovements, setFetalMovements] = useState(0)
    const [waterGlasses, setWaterGlasses] = useState(0)
    const [foodText, setFoodText] = useState('')
    const [selectedMood, setSelectedMood] = useState('')

    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session) {
                console.log("No session found, using demo mode")
                const mockUser = { id: 'mock-id', user_metadata: { full_name: 'Sarah Miller' } } as any
                setUser(mockUser)
                setLoading(false)
                return
            }
            
            setUser(session.user)
            setLoading(false)
        }
        getUser()
    }, [])

    const toggleSymptom = (symptom: string) => {
        setSelectedSymptoms(prev =>
            prev.includes(symptom)
                ? prev.filter(s => s !== symptom)
                : [...prev, symptom]
        )
    }

    const handleSubmit = async () => {
        if (!user) return
        setSubmitting(true)
        setMessage('')

        try {
            // 1. Log Symptoms
            if (selectedSymptoms.length > 0) {
                const symptomData = selectedSymptoms.map(s => ({
                    user_id: user.id,
                    symptom_name: s,
                    severity: severity
                }))
                await supabase.from('symptoms').insert(symptomData)
            }

            // 2. Log Fetal Movements
            if (fetalMovements > 0) {
                await supabase.from('fetal_movements').insert({
                    user_id: user.id,
                    movement_count: fetalMovements
                })
            }

            // 3. Log Water Intake
            if (waterGlasses > 0) {
                await supabase.from('water_intake').insert({
                    user_id: user.id,
                    glasses: waterGlasses
                })
            }

            // 4. Log Food
            if (foodText.trim()) {
                await supabase.from('nutrition_logs').insert({
                    user_id: user.id,
                    food_description: foodText.trim(),
                    calories: 0 // Default or estimated
                })
            }

            setMessage('Biological telemetry successfully synchronized.')

            // Reset form
            setSelectedSymptoms([])
            setSeverity(1)
            setFetalMovements(0)
            setWaterGlasses(0)
            setFoodText('')
            setSelectedMood('')

        } catch (error) {
            console.error('Log Error:', error)
            setMessage('Telemetry synchronization failed. Please retry signal broadcast.')
        } finally {
            setSubmitting(false)
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
                            <h1 className="text-4xl font-black text-foreground tracking-tighter">Manual Telemetry</h1>
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] tracking-widest px-4 py-1.5 uppercase rounded-full">
                                Direct Uplink
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium mt-1">Cross-verify your subjective biological experience with neural model predictions.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">

                    {/* LEFT: SYMPTOMS & SEVERITY */}
                    <div className="xl:col-span-8 space-y-12">

                        <div className="glassmorphism p-12 rounded-[56px] border border-border/50 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                <Zap className="w-48 h-48 -rotate-12" />
                            </div>

                            <div className="relative z-10 space-y-12">
                                <div className="space-y-4">
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] px-2 opacity-60">Neural Pattern Deviation (Symptoms)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        {SYMPTOMS.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => toggleSymptom(s)}
                                                className={cn(
                                                    "p-6 rounded-[32px] border text-[10px] font-black uppercase tracking-widest transition-all text-center h-24 flex items-center justify-center",
                                                    selectedSymptoms.includes(s)
                                                        ? "bg-primary text-white border-primary shadow-xl shadow-primary/30 scale-105"
                                                        : "glassmorphism border-border/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                                                )}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedSymptoms.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-6 pt-6 border-t border-border/20"
                                    >
                                        <div className="flex justify-between items-center px-2">
                                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] opacity-60">Variance Intensity</h3>
                                            <span className="text-2xl font-black text-primary tracking-tighter">Tier {severity}</span>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            {[1, 2, 3, 4, 5].map((lvl) => (
                                                <button
                                                    key={lvl}
                                                    onClick={() => setSeverity(lvl)}
                                                    className={cn(
                                                        "flex-1 h-14 rounded-2xl font-black text-sm transition-all border",
                                                        severity >= lvl
                                                            ? "bg-primary border-primary text-white shadow-xl shadow-primary/20"
                                                            : "bg-muted/10 border-border/30 text-muted-foreground"
                                                    )}
                                                >
                                                    {lvl}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* FETAL & WATER LOGS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* Fetal Section */}
                            <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20">
                                        <Baby className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Gestational Pulse</h3>
                                </div>
                                <div className="flex items-center justify-between p-8 rounded-[40px] bg-muted/5 border border-border/30">
                                    <button onClick={() => setFetalMovements(Math.max(0, fetalMovements - 1))} className="w-16 h-16 rounded-2xl glassmorphism border border-border/50 flex flex-center items-center justify-center hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-all">
                                        <Minus className="w-5 h-5" />
                                    </button>
                                    <div className="text-center">
                                        <div className="text-5xl font-black text-foreground tracking-tighter mb-1">{fetalMovements}</div>
                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Kicks (Verified)</span>
                                    </div>
                                    <button onClick={() => setFetalMovements(fetalMovements + 1)} className="w-16 h-16 rounded-2xl glassmorphism border border-border/50 flex flex-center items-center justify-center hover:bg-primary hover:text-white transition-all shadow-xl hover:shadow-primary/20">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Water Intake Section */}
                            <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 rounded-3xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                        <Droplets className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Hydration Flux</h3>
                                </div>
                                <div className="flex items-center justify-between p-8 rounded-[40px] bg-muted/5 border border-border/30">
                                    <button onClick={() => setWaterGlasses(Math.max(0, waterGlasses - 1))} className="w-16 h-16 rounded-2xl glassmorphism border border-border/50 flex flex-center items-center justify-center hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-all">
                                        <Minus className="w-5 h-5" />
                                    </button>
                                    <div className="text-center">
                                        <div className="text-5xl font-black text-foreground tracking-tighter mb-1">{waterGlasses}</div>
                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Vessels (Aprox)</span>
                                    </div>
                                    <button onClick={() => setWaterGlasses(waterGlasses + 1)} className="w-16 h-16 rounded-2xl glassmorphism border border-border/50 flex flex-center items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-xl hover:shadow-blue-500/20">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: NUTRITION & MOOD */}
                    <div className="xl:col-span-4 space-y-12">

                        {/* Nutrition Log */}
                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Utensils className="w-24 h-24" />
                            </div>
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] pl-2">Metabolic Intake Log</h3>
                            <textarea
                                value={foodText}
                                onChange={(e) => setFoodText(e.target.value)}
                                placeholder="Describe nutritional infusion..."
                                className="w-full h-48 p-8 rounded-[32px] glassmorphism border border-border/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-semibold text-foreground placeholder:text-muted-foreground/30 text-base shadow-inner resize-none"
                            />
                            <div className="flex items-center gap-3 p-6 rounded-[28px] bg-primary/5 border border-primary/20">
                                <Zap className="w-5 h-5 text-primary opacity-60" />
                                <p className="text-[10px] font-semibold text-muted-foreground leading-tight italic">
                                    "Clinical model will estimate caloric load and fiber density automatically."
                                </p>
                            </div>
                        </div>

                        {/* Mood / Neural Drift */}
                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-10">
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] pl-2">Subjective Neural state</h3>
                            <div className="grid grid-cols-5 gap-4">
                                {MOODS.map(m => (
                                    <button
                                        key={m.label}
                                        onClick={() => setSelectedMood(m.label)}
                                        className={cn(
                                            "flex flex-col items-center gap-3 p-4 rounded-2xl transition-all group",
                                            selectedMood === m.label ? "bg-primary/10 border-primary/30" : "hover:bg-muted/10 border-transparent"
                                        )}
                                    >
                                        <span className={cn("text-3xl transition-transform duration-500", selectedMood === m.label ? "scale-125" : "grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100")}>{m.emoji}</span>
                                        <span className={cn("text-[8px] font-black uppercase tracking-widest text-center leading-none", selectedMood === m.label ? "text-primary" : "text-muted-foreground opacity-40")}>{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="space-y-6">
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full h-24 rounded-[36px] bg-foreground text-background font-black uppercase tracking-[0.4em] text-xs hover:opacity-95 shadow-[0_40px_80px_rgba(0,0,0,0.2)] transition-all group"
                            >
                                {submitting ? 'Synchronizing Node...' : 'Broadcast Signal'}
                                <ChevronRight className="ml-4 w-6 h-6 group-hover:translate-x-2 transition-transform" />
                            </Button>

                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        "p-6 rounded-[28px] text-center text-[10px] font-black uppercase tracking-widest border shadow-xl shadow-success/10",
                                        message.includes('failed') ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-success/10 border-success/20 text-success"
                                    )}
                                >
                                    {message}
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
