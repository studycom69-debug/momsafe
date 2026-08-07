"use client"

import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
    Stethoscope,
    Video,
    MessageSquare,
    Phone,
    Calendar,
    Clock,
    ChevronRight,
    FileText,
    Award,
    Star,
    MapPin,
    ShieldCheck,
    Brain,
    Activity,
    Users,
    Heart,
    CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const doctors = [
    {
        id: '1',
        name: 'Dr. Sarah Chen',
        specialty: 'Maternal-Fetal Medicine',
        rating: 4.9,
        reviews: 342,
        experience: '14 years',
        status: 'available',
        nextAvailable: 'Today, 2:30 PM',
        education: 'MD, Johns Hopkins',
        certifications: ['ABOG Certified', 'MFM Subspecialty'],
        languages: ['English', 'Mandarin'],
        avatar: 'SC'
    },
    {
        id: '2',
        name: 'Dr. Michael Roberts',
        specialty: 'Obstetrics & Gynecology',
        rating: 4.8,
        reviews: 518,
        experience: '18 years',
        status: 'available',
        nextAvailable: 'Tomorrow, 10:00 AM',
        education: 'MD, Harvard Medical',
        certifications: ['ABOG Certified', 'Robotic Surgery'],
        languages: ['English', 'Spanish'],
        avatar: 'MR'
    },
    {
        id: '3',
        name: 'Dr. Emily Watson',
        specialty: 'Midwifery & Prenatal Care',
        rating: 5.0,
        reviews: 287,
        experience: '11 years',
        status: 'in-session',
        nextAvailable: 'Thu, 9:15 AM',
        education: 'CNM, Yale Nursing',
        certifications: ['AMCB Certified', 'Lactation Counselor'],
        languages: ['English', 'French'],
        avatar: 'EW'
    },
]

const upcomingAppointments = [
    { id: '1', doctor: 'Dr. Sarah Chen', type: 'Anomaly Scan', date: 'Today', time: '2:30 PM', duration: '45 min', mode: 'In-Person', location: 'St. Mary\'s Hospital, Room 402' },
    { id: '2', doctor: 'Dr. Emily Watson', type: 'Weekly Prenatal Check', date: 'Wednesday', time: '11:00 AM', duration: '30 min', mode: 'Telehealth', location: 'Video Call' },
    { id: '3', doctor: 'Nutrition Team', type: 'Diet Plan Review', date: 'Friday', time: '3:00 PM', duration: '25 min', mode: 'Telehealth', location: 'Video Call' },
]

const documents = [
    { name: '12-Week Ultrasound Report', date: 'Mar 12', type: 'Report', icon: FileText },
    { name: 'Blood Work Panel Results', date: 'Mar 08', type: 'Lab', icon: Activity },
    { name: 'Prenatal Vitamin Rx', date: 'Feb 28', type: 'Prescription', icon: ShieldCheck },
    { name: 'Birth Plan Draft', date: 'Feb 20', type: 'Plan', icon: Brain },
]

export default function DoctorPage() {
    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-black text-foreground tracking-tighter">Your Care Team</h1>
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-black text-[10px] tracking-widest px-4 py-1.5 uppercase rounded-full">
                                Connected
                            </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium mt-1">Board-certified OB-GYNs, midwives, and specialists — ready when you need them.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2 border-border/50">
                            <Calendar className="w-4 h-4" /> My Schedule
                        </Button>
                        <Button className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-200 hover:opacity-90">
                            <Stethoscope className="w-4 h-4" /> Book Appointment
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Upcoming Visits', value: upcomingAppointments.length, icon: Calendar, sub: `Next: ${upcomingAppointments[0].time}`, color: 'from-violet-500 to-purple-600' },
                        { label: 'Care Team Size', value: doctors.length, icon: Users, sub: '2 OB-GYNs + 1 Midwife', color: 'from-blue-500 to-indigo-600' },
                        { label: 'Avg Response Time', value: '< 2 hrs', icon: Clock, sub: 'Monitored 24/7', color: 'from-emerald-500 to-teal-600' },
                    ].map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                            className="glassmorphism p-8 rounded-[40px] border border-border/50 relative overflow-hidden">
                            <div className={cn("absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-20 bg-gradient-to-br", s.color)} />
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-70">{s.label}</p>
                                    <div className={cn("w-10 h-10 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-md", s.color)}>
                                        <s.icon className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-4xl font-black text-foreground tracking-tighter leading-none">{s.value}</p>
                                <p className="text-[11px] font-bold text-muted-foreground">{s.sub}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-12">
                        <div className="space-y-8">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Upcoming Appointments</h3>
                                <Link href="/alerts" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1">
                                    View All <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {upcomingAppointments.map((apt, i) => (
                                    <motion.div key={apt.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                                        className="glassmorphism p-8 rounded-[40px] border border-border/50 hover:shadow-xl transition-all group">
                                        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                                            <div className="flex items-center gap-6 flex-1 min-w-0">
                                                <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-violet-500 to-purple-600 text-white flex flex-col items-center justify-center shadow-lg shadow-violet-200 shrink-0">
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">{apt.date.split(',')[0]}</span>
                                                    <span className="text-lg font-black leading-tight">{apt.date.split(',')[1]?.trim() || apt.time.split(':')[0]}</span>
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h4 className="text-xl font-black text-foreground tracking-tight truncate">{apt.doctor}</h4>
                                                        <Badge className="text-[9px] font-black uppercase tracking-widest rounded-full px-3 bg-primary/10 text-primary border-primary/20">
                                                            {apt.type}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-muted-foreground">
                                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {apt.time} • {apt.duration}</span>
                                                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {apt.mode}</span>
                                                        <span className="flex items-center gap-1.5 truncate">{apt.location}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                {apt.mode === 'Telehealth' ? (
                                                    <Button className="h-12 px-5 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:opacity-90">
                                                        <Video className="w-4 h-4 mr-2" /> Join
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" className="h-12 px-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50">
                                                        <MapPin className="w-4 h-4 mr-2" /> Directions
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-foreground">
                                                    <Phone className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Available Doctors</h3>
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border/50 text-muted-foreground rounded-full">
                                    {doctors.filter(d => d.status === 'available').length} Online Now
                                </Badge>
                            </div>
                            <div className="space-y-6">
                                {doctors.map((doc, i) => (
                                    <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                        className="glassmorphism p-10 rounded-[48px] border border-border/50 hover:shadow-2xl transition-all">
                                        <div className="flex flex-col md:flex-row gap-8">
                                            <div className="flex gap-6 flex-1 min-w-0">
                                                <Avatar className="w-20 h-20 rounded-[28px] shadow-lg border-4 border-white shrink-0">
                                                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-xl tracking-tight">
                                                        {doc.avatar}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 space-y-4 flex-1">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="space-y-1 min-w-0">
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <h3 className="text-2xl font-black text-foreground tracking-tight truncate">{doc.name}</h3>
                                                                {doc.status === 'available' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-[9px] font-black uppercase tracking-widest">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> In Session
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm font-bold text-primary tracking-tight">{doc.specialty}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                                                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                            <span className="text-sm font-black text-amber-700 tracking-tight">{doc.rating}</span>
                                                            <span className="text-[10px] font-bold text-amber-700/70">({doc.reviews})</span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <div className="p-3 rounded-2xl bg-white/70 border border-border/30 space-y-0.5">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-70">Experience</p>
                                                            <p className="text-xs font-black text-foreground">{doc.experience}</p>
                                                        </div>
                                                        <div className="p-3 rounded-2xl bg-white/70 border border-border/30 space-y-0.5">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-70">Education</p>
                                                            <p className="text-xs font-black text-foreground truncate">{doc.education}</p>
                                                        </div>
                                                        <div className="p-3 rounded-2xl bg-white/70 border border-border/30 space-y-0.5">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-70">Board</p>
                                                            <p className="text-xs font-black text-foreground truncate">{doc.certifications[0]}</p>
                                                        </div>
                                                        <div className="p-3 rounded-2xl bg-white/70 border border-border/30 space-y-0.5">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-70">Next Slot</p>
                                                            <p className="text-xs font-black text-emerald-600 truncate">{doc.nextAvailable}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex md:flex-col gap-2 shrink-0 md:justify-between">
                                                <Link href={`/doctor/patient/${doc.id}`} className="flex-1">
                                                    <Button variant="outline" className="w-full h-12 md:h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50 gap-2 hover:bg-primary hover:text-white hover:border-primary transition-all">
                                                        <FileText className="w-4 h-4" /> Profile
                                                    </Button>
                                                </Link>
                                                <div className="flex md:flex-col gap-2 flex-1">
                                                    <Button variant="ghost" className="flex-1 h-12 md:h-12 rounded-2xl text-primary bg-primary/5 hover:bg-primary/10 font-black text-[10px] uppercase tracking-widest gap-2">
                                                        <MessageSquare className="w-4 h-4" /> Chat
                                                    </Button>
                                                    <Button className="flex-1 h-12 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:opacity-90 gap-2">
                                                        <Video className="w-4 h-4" /> Book
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em]">Medical Documents</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Secure & Encrypted</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {documents.map((d, i) => (
                                    <div key={i} className="p-5 rounded-[24px] bg-white/70 border border-border/30 hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                <d.icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-foreground truncate tracking-tight">{d.name}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">{d.type} • {d.date}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" className="w-full h-12 rounded-2xl border-dashed border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
                                Upload Document
                            </Button>
                        </div>

                        <div className="p-10 rounded-[48px] bg-foreground text-background shadow-[0_40px_100px_rgba(0,0,0,0.15)] overflow-hidden relative">
                            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-[20px] bg-white/15 border border-white/20 flex items-center justify-center">
                                        <Award className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black tracking-tighter">Care Excellence</h3>
                                        <div className="flex items-center gap-1 mt-1">
                                            {[1,2,3,4,5].map(s => (
                                                <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        { label: "Board-certified specialists", ok: true },
                                        { label: "Same-day telehealth slots", ok: true },
                                        { label: "Insurance accepted", ok: true },
                                        { label: "HIPAA-compliant messaging", ok: true },
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                            <span className="text-sm font-semibold text-white/80 tracking-tight">{f.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <Button className="w-full h-14 rounded-[24px] bg-white text-foreground font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-90 shadow-xl gap-2">
                                    <Heart className="w-4 h-4" /> Premium Care Upgrade
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
