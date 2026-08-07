"use client"

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import {
    Bot,
    Send,
    Brain,
    Heart,
    Activity,
    Sparkles,
    MessageSquare,
    User,
    Clock,
    ChevronRight,
    Stethoscope,
    Lightbulb,
    ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessage {
    id: string
    role: 'user' | 'ai'
    content: string
    timestamp: string
    tags?: string[]
}

const suggestedPrompts = [
    { icon: Heart, label: "Is this symptom normal?", color: "text-rose-500", bg: "bg-rose-500/10" },
    { icon: Activity, label: "Review my vitals trend", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Stethoscope, label: "Should I call my doctor?", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: Lightbulb, label: "Give me nutrition tips", color: "text-amber-500", bg: "bg-amber-500/10" },
]

const initialMessages: ChatMessage[] = [
    {
        id: '1',
        role: 'ai',
        content: "Hi Helen! I'm your AI pregnancy companion. I've been monitoring your vitals today — everything looks excellent with a 92% proactive health score. How can I support you today?",
        timestamp: 'Just now',
        tags: ['Health Score: 92%', 'Vitals Stable']
    }
]

export default function AICompanionPage() {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [input, setInput] = useState('')
    const [typing, setTyping] = useState(false)

    const handleSend = (text?: string) => {
        const content = (text || input).trim()
        if (!content) return

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setTyping(true)

        setTimeout(() => {
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: "Great question! Based on your recent health data, everything is within safe parameters. Your heart rate variability is excellent, sleep quality is trending upward, and hydration levels are on target today. Keep up the amazing work — you're doing fantastic.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                tags: ['Confidence: 96%', 'Low Risk']
            }
            setMessages(prev => [...prev, aiMsg])
            setTyping(false)
        }, 1200)
    }

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-black text-foreground tracking-tighter">AI Companion</h1>
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] tracking-widest px-4 py-1.5 uppercase rounded-full">
                                24/7 Available
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium mt-1">Intelligent pregnancy guidance backed by real-time health data.</p>
                    </div>
                    <div className="glassmorphism p-5 rounded-[28px] border border-border/50 flex items-center gap-6 px-10">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-200">
                            <Brain className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1 opacity-60">Model</span>
                            <span className="text-sm font-black text-foreground tracking-tight">MomSafe Clinical AI</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-6">
                        <div className="glassmorphism rounded-[48px] border border-border/50 shadow-2xl overflow-hidden flex flex-col min-h-[600px]">
                            <div className="px-10 py-6 border-b border-border/30 flex items-center justify-between bg-gradient-to-b from-emerald-500/5 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-[3px] border-white animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-foreground tracking-tight">MomSafe AI Assistant</h3>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Online • HIPAA Compliant</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <Sparkles className="w-4 h-4 text-emerald-600" />
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Enhanced Analysis</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-8 max-h-[500px]">
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={cn(
                                            "flex gap-5",
                                            msg.role === 'user' && "flex-row-reverse"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-md",
                                            msg.role === 'ai'
                                                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                                : "bg-slate-100 text-slate-600 border border-border/50"
                                        )}>
                                            {msg.role === 'ai' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                        </div>
                                        <div className={cn(
                                            "max-w-[80%] space-y-3",
                                            msg.role === 'user' && "items-end"
                                        )}>
                                            <div className={cn(
                                                "p-6 rounded-[32px] shadow-sm",
                                                msg.role === 'ai'
                                                    ? "bg-white border border-border/30 rounded-tl-[8px]"
                                                    : "bg-foreground text-background rounded-tr-[8px]"
                                            )}>
                                                <p className="text-sm font-semibold leading-relaxed tracking-tight">{msg.content}</p>
                                            </div>
                                            {msg.tags && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {msg.tags.map((tag, t) => (
                                                        <Badge key={t} variant="outline" className="text-[9px] font-black uppercase tracking-widest py-1 px-3 border-border/40 text-muted-foreground">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            <p className={cn(
                                                "text-[9px] font-black uppercase tracking-widest flex items-center gap-2",
                                                msg.role === 'user' ? "justify-end text-muted-foreground" : "text-muted-foreground"
                                            )}>
                                                <Clock className="w-3 h-3" /> {msg.timestamp}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                                {typing && (
                                    <div className="flex gap-5">
                                        <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                        <div className="p-6 rounded-[32px] bg-white border border-border/30 rounded-tl-[8px] shadow-sm">
                                            <div className="flex gap-1.5 items-center">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-10 pb-8 space-y-4">
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {suggestedPrompts.map((p, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(p.label)}
                                            className={cn(
                                                "shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl border border-border/40 bg-white/60 hover:bg-white hover:scale-[1.02] hover:shadow-md transition-all group"
                                            )}
                                        >
                                            <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", p.bg)}>
                                                <p.icon className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-[11px] font-bold text-foreground tracking-tight whitespace-nowrap">{p.label}</span>
                                            <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </button>
                                    ))}
                                </div>

                                <div className="relative">
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                        placeholder="Ask about symptoms, nutrition, baby development..."
                                        className="h-16 pl-6 pr-20 rounded-[28px] text-sm font-semibold bg-white border-border/50 shadow-lg shadow-black/5 focus-visible:ring-primary"
                                    />
                                    <Button
                                        onClick={() => handleSend()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-[20px] bg-gradient-to-br from-emerald-500 to-teal-600 hover:opacity-90 shadow-lg shadow-emerald-200"
                                    >
                                        <Send className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Safety First</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Clinical Guardrails Active</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { label: "Emergency override protocols", status: "Active" },
                                    { label: "Real clinician escalation", status: "Enabled" },
                                    { label: "Drug interaction checks", status: "Running" },
                                    { label: "Anomaly detection", status: "Monitoring" },
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-border/30">
                                        <span className="text-xs font-bold text-foreground tracking-tight">{s.label}</span>
                                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[9px] font-black uppercase tracking-widest rounded-full">
                                            {s.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-10 rounded-[48px] bg-foreground text-background shadow-[0_40px_100px_rgba(0,0,0,0.15)] space-y-6 overflow-hidden relative">
                            <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/20 blur-3xl rounded-full" />
                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-black tracking-tighter">Need human support?</h3>
                                </div>
                                <p className="text-xs font-semibold text-background/60 leading-relaxed">
                                    Connect with a board-certified OB-GYN or licensed midwife instantly through secure video consultation.
                                </p>
                                <div className="flex gap-3">
                                    <Button className="flex-1 bg-white text-foreground font-black text-[10px] uppercase tracking-widest h-14 rounded-2xl hover:opacity-90">
                                        Talk to Doctor
                                    </Button>
                                    <Button variant="outline" className="flex-1 border-white/20 bg-transparent text-white font-black text-[10px] uppercase tracking-widest h-14 rounded-2xl hover:bg-white/10">
                                        Nurse Chat
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
