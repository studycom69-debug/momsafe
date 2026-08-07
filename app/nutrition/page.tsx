"use client"

import { useEffect, useState } from 'react'
import AppLayout from "@/components/layout/AppLayout"
import { motion } from "framer-motion"
import { supabase } from '@/lib/supabaseClient'
import { User as SupabaseUser } from '@supabase/supabase-js'
import {
    Apple,
    Droplets,
    Salad,
    Fish,
    Milk,
    Sun,
    ChevronRight,
    Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

const mealCategories = [
    {
        time: "Breakfast",
        timeRange: "7:00 AM - 9:00 AM",
        icon: Sun,
        color: "from-amber-400 to-orange-500",
        suggestions: ["Oatmeal with berries", "Greek yogurt with granola", "Whole grain toast with egg", "Fresh fruit bowl"]
    },
    {
        time: "Lunch",
        timeRange: "12:00 PM - 1:30 PM",
        icon: Salad,
        color: "from-emerald-400 to-teal-600",
        suggestions: ["Grilled chicken salad", "Quinoa bowl with veggies", "Salmon and sweet potato", "Lentil soup with bread"]
    },
    {
        time: "Dinner",
        timeRange: "6:00 PM - 8:00 PM",
        icon: Fish,
        color: "from-blue-400 to-indigo-600",
        suggestions: ["Baked cod and asparagus", "Turkey meatballs & pasta", "Stir fry tofu and rice", "Beef stew with carrots"]
    },
    {
        time: "Dairy & Calcium",
        timeRange: "Daily",
        icon: Milk,
        color: "from-violet-400 to-purple-600",
        suggestions: ["2 servings yogurt", "1 glass milk or fortified", "Cheese in moderation", "Calcium-fortified cereal"]
    }
]

export default function NutritionPage() {
    const [user, setUser] = useState<SupabaseUser | null | { name: string }>({ name: "User" })
    const [waterGlasses, setWaterGlasses] = useState(5)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                setUser(session.user)
            }
            setLoading(false)
        }
        getSession()
    }, [])

    const waterGoal = 10
    const waterProgress = Math.min(100, (waterGlasses / waterGoal) * 100)

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-sans">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
    )

    return (
        <AppLayout unreadCount={0}>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-2"
                >
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-600/80">
                        Nutrition Tracker
                    </p>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">
                        Your Nutrition &amp; Diet
                    </h1>
                    <p className="text-slate-500 font-medium max-w-2xl">
                        Personalized food and hydration plans that evolve with your pregnancy. Fueling both you and your baby.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-5">
                        <Card className="p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative bg-gradient-to-br from-blue-50 via-cyan-50 to-white">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
                                <Droplets className="w-40 h-40 text-blue-700" />
                            </div>
                            <div className="relative space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                                        <Droplets className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Daily Hydration</h3>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Aim for 2.5L</p>
                                    </div>
                                </div>

                                <div className="flex items-end gap-6">
                                    <div>
                                        <p className="text-6xl font-black text-blue-600 tracking-tighter leading-none">{waterGlasses}</p>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">of {waterGoal} glasses</p>
                                    </div>
                                    <div className="flex-1 pb-2 space-y-3">
                                        <div className="h-3 bg-white rounded-full overflow-hidden border border-blue-100">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${waterProgress}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-blue-600/80 uppercase tracking-widest">{Math.round(waterProgress)}% complete</p>
                                            <Badge className="bg-blue-50 text-blue-600 border-none font-bold text-[10px] px-3 py-1 rounded-full">
                                                {waterGoal - waterGlasses} left
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setWaterGlasses(Math.max(0, waterGlasses - 1))}
                                        variant="outline"
                                        className="flex-1 h-12 rounded-2xl font-bold text-[11px] uppercase tracking-widest border-slate-200"
                                    >
                                        - Remove
                                    </Button>
                                    <Button
                                        onClick={() => setWaterGlasses(Math.min(waterGoal * 2, waterGlasses + 1))}
                                        className="flex-1 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-blue-100"
                                    >
                                        + Add Glass
                                    </Button>
                                </div>

                                <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white/80">
                                    <div className="flex gap-3 items-start">
                                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                            Proper hydration supports amniotic fluid levels, blood volume, and can help reduce swelling. Add a slice of lemon if plain water feels bland!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="md:col-span-7 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Today&apos;s Meal Ideas</h2>
                            <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[10px] px-4 py-1.5 rounded-full">
                                Trimester-Appropriate
                            </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {mealCategories.map((meal, i) => (
                                <motion.div
                                    key={meal.time}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                >
                                    <Card className="p-6 rounded-3xl border border-slate-100 shadow-sm h-full hover:shadow-md hover:border-slate-200 transition-all duration-300 cursor-pointer group">
                                        <div className="flex items-start justify-between mb-5">
                                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${meal.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                                                <meal.icon className="w-5 h-5" />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{meal.time}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{meal.timeRange}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-5">
                                            {meal.suggestions.map((s, j) => (
                                                <div key={j} className="flex items-center gap-3">
                                                    <Apple className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                    <p className="text-[13px] font-medium text-slate-700 leading-tight">{s}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-800 transition-all">
                                            <span className="text-[11px] font-black uppercase tracking-widest">View full plan</span>
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                <Card className="p-8 rounded-3xl border-2 border-dashed border-slate-200 bg-white/50">
                    <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-100 shrink-0">
                            <Apple className="w-8 h-8" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Personalized AI Nutrition Plan</h3>
                            <p className="text-[14px] text-slate-500 font-medium max-w-2xl">
                                Get a complete, trimester-specific meal plan tailored to your allergies, dietary preferences, and nutritional gaps. Just answer a few quick questions!
                            </p>
                        </div>
                        <Button className="h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-[11px] uppercase tracking-widest px-8 shadow-lg shadow-slate-200">
                            Generate My Plan
                        </Button>
                    </div>
                </Card>
            </div>
        </AppLayout>
    )
}
