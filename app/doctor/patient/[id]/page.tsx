"use client"

import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    Calendar,
    Clock,
    Video,
    MessageSquare,
    Phone,
    Star,
    Award,
    FileText,
    Activity,
    Stethoscope,
    Users,
    MapPin,
    Heart,
    CheckCircle2,
    ChevronRight,
    Brain
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function DoctorPatientPage({ params }: { params: { id: string } }) {
    const router = useRouter()

    const doctor = {
        id: params.id,
        name: 'Dr. Sarah Chen',
        specialty: 'Maternal-Fetal Medicine',
        rating: 4.9,
        reviews: 342,
        experience: '14 years',
        status: 'available',
        education: 'MD, Johns Hopkins School of Medicine',
        residency: 'Obstetrics & Gynecology, UCSF',
        fellowship: 'Maternal-Fetal Medicine, Stanford',
        certifications: ['ABOG Board Certified', 'MFM Subspecialty Certified', 'FLS - Advanced Laparoscopy'],
        languages: ['English', 'Mandarin', 'Medical Spanish'],
        avatar: 'SC',
        acceptedPlans: ['Aetna', 'Blue Cross', 'Cigna', 'Kaiser', 'UnitedHealthcare'],
        bio: "Dr. Chen is a fellowship-trained maternal-fetal medicine specialist with over a decade of experience managing high-risk pregnancies. She pioneered the integrated remote monitoring program at Johns Hopkins and has published 28 peer-reviewed papers on preterm birth prevention and hypertensive disorders of pregnancy."
    }

    const timeSlots = [
        { day: 'Today', date: 'Mar 17', times: ['1:00 PM', '2:30 PM', '4:15 PM'] },
        { day: 'Tomorrow', date: 'Mar 18', times: ['9:00 AM', '10:30 AM', '11:45 AM', '3:30 PM'] },
        { day: 'Wednesday', date: 'Mar 19', times: ['8:15 AM', '1:00 PM', '2:00 PM'] },
    ]

    const conditions = ['High Blood Pressure', 'Multiple Gestation', 'Preterm Labor History', 'Gestational Diabetes', 'Advanced Maternal Age']
    const procedures = ['Anomaly Scan', 'Doppler Ultrasound', 'Cervical Cerclage', 'Amniocentesis', 'Non-Stress Test']

    const reviews = [
        { name: 'Jessica M.', rating: 5, text: 'Dr. Chen caught my preeclampsia signs 3 weeks before symptoms. Saved my baby and me. Forever grateful.', date: '2 weeks ago' },
        { name: 'Priya S.', rating: 5, text: 'Incredibly thorough and genuinely caring. Answers every question at 2 AM even. Would 100% recommend.', date: '1 month ago' },
        { name: 'Amanda K.', rating: 5, text: 'Best MFM in the region. My twins were delivered at 36w perfectly thanks to her monitoring plan.', date: '2 months ago' },
    ]

    return (
        <AppLayout>
            <div className="max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-12 w-12 rounded-2xl bg-white/60 border border-border/50 hover:bg-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">Doctor Profile</p>
                        <h1 className="text-3xl font-black text-foreground tracking-tighter">Specialist Detail</h1>
                    </div>
                </div>

                <div className="glassmorphism p-10 md:p-14 rounded-[56px] border border-border/50 shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/10 blur-3xl" />
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
                        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-center lg:items-start gap-8">
                            <Avatar className="w-32 h-32 rounded-[40px] shadow-2xl border-[6px] border-white shrink-0">
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-4xl tracking-tight">
                                    {doctor.avatar}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center sm:text-left lg:text-center space-y-5 flex-1">
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-foreground tracking-tighter">{doctor.name}</h2>
                                    <p className="text-sm font-bold text-primary tracking-tight">{doctor.specialty}</p>
                                </div>
                                <div className="flex items-center justify-center sm:justify-start lg:justify-center gap-2 py-2 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 w-fit mx-auto sm:mx-0 lg:mx-auto">
                                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                                    <span className="text-lg font-black text-amber-700 tracking-tight">{doctor.rating}</span>
                                    <span className="text-[11px] font-bold text-amber-700/70">({doctor.reviews} reviews)</span>
                                </div>
                                <div className="flex items-center justify-center sm:justify-start lg:justify-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Accepting Patients
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 pt-2">
                                    {[
                                        { value: doctor.experience, label: 'Experience', icon: Award },
                                        { value: '28', label: 'Publications', icon: FileText },
                                        { value: '98%', label: 'Success', icon: Heart },
                                    ].map((s, i) => (
                                        <div key={i} className="p-4 rounded-[22px] bg-white/70 border border-border/40 text-center space-y-1">
                                            <s.icon className="w-4 h-4 mx-auto text-primary" />
                                            <p className="text-base font-black text-foreground tracking-tight leading-none">{s.value}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-3 pt-2 w-full">
                                    <Button className="flex-1 h-14 rounded-[22px] font-black text-[10px] uppercase tracking-[0.2em] gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-200 hover:opacity-90">
                                        <Calendar className="w-4 h-4" /> Book Now
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <Button variant="outline" className="h-12 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 border-border/50">
                                        <MessageSquare className="w-4 h-4" /> Chat
                                    </Button>
                                    <Button variant="outline" className="h-12 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 border-border/50">
                                        <Phone className="w-4 h-4" /> Call
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-8 space-y-10">
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-primary" /> About Dr. Chen
                                </h3>
                                <p className="text-sm font-semibold text-muted-foreground leading-relaxed">
                                    {doctor.bio}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-8 rounded-[36px] bg-white/70 border border-border/40 space-y-5">
                                    <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> Credentials</h4>
                                    <div className="space-y-4 text-sm">
                                        {[
                                            ['Medical Degree', doctor.education],
                                            ['Residency', doctor.residency],
                                            ['Fellowship', doctor.fellowship],
                                        ].map(([l, v], i) => (
                                            <div key={i} className="flex gap-4">
                                                <span className="w-28 shrink-0 text-[10px] font-black text-muted-foreground uppercase tracking-widest pt-1">{l}</span>
                                                <span className="font-bold text-foreground tracking-tight">{v}</span>
                                            </div>
                                        ))}
                                        <div className="flex gap-4 pt-2">
                                            <span className="w-28 shrink-0 text-[10px] font-black text-muted-foreground uppercase tracking-widest pt-1">Board Certs</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {doctor.certifications.map((c, i) => (
                                                    <Badge key={i} className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest rounded-full">{c}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 pt-2">
                                            <span className="w-28 shrink-0 text-[10px] font-black text-muted-foreground uppercase tracking-widest pt-1">Languages</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {doctor.languages.map((l, i) => (
                                                    <Badge key={i} variant="outline" className="text-[9px] font-black uppercase tracking-widest rounded-full border-border/50 text-muted-foreground">{l}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 rounded-[36px] bg-white/70 border border-border/40 space-y-5">
                                    <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Affiliations & Insurance</h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Practicing At</p>
                                            <div className="space-y-2">
                                                {[
                                                    { name: "St. Mary's Hospital", loc: "Maternity Floor 4" },
                                                    { name: "Advanced Women's Clinic", loc: "Suite 600, Medical Plaza" },
                                                ].map((h, i) => (
                                                    <div key={i} className="p-4 rounded-2xl bg-white border border-border/30 flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Stethoscope className="w-5 h-5" /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-foreground tracking-tight truncate">{h.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h.loc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Insurance Accepted</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {doctor.acceptedPlans.map((p, i) => (
                                                    <span key={i} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3 h-3" /> {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-8 rounded-[36px] bg-rose-500/[0.03] border border-rose-500/20 space-y-5">
                                    <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-[0.3em] flex items-center gap-2"><Heart className="w-4 h-4" /> Special Expertise</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {conditions.map((c, i) => (
                                            <span key={i} className="px-4 py-2 rounded-2xl bg-white border border-rose-500/10 text-rose-700 text-[11px] font-bold tracking-tight shadow-sm">{c}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-8 rounded-[36px] bg-blue-500/[0.03] border border-blue-500/20 space-y-5">
                                    <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-[0.3em] flex items-center gap-2"><Activity className="w-4 h-4" /> Procedures Performed</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {procedures.map((p, i) => (
                                            <span key={i} className="px-4 py-2 rounded-2xl bg-white border border-blue-500/10 text-blue-700 text-[11px] font-bold tracking-tight shadow-sm">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-8">
                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-10">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary" /> Available Appointment Slots
                                </h3>
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border/50 text-muted-foreground rounded-full">
                                    10 Open Slots This Week
                                </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {timeSlots.map((slot, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                                        className="p-6 rounded-[32px] bg-white/70 border border-border/40 hover:shadow-lg hover:scale-[1.01] transition-all">
                                        <div className="flex items-center justify-between mb-5">
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-70">{slot.day}</p>
                                                <p className="text-xl font-black text-foreground tracking-tight">{slot.date}</p>
                                            </div>
                                            <Clock className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="space-y-2">
                                            {slot.times.map((t, t2) => (
                                                <button key={t2} className="w-full group h-11 rounded-xl border border-border/40 text-[11px] font-black uppercase tracking-widest text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center justify-between px-4">
                                                    {t}
                                                    <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between p-6 rounded-[32px] bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-primary/20 flex items-center justify-center">
                                        <Video className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground tracking-tight flex items-center gap-2">
                                            Telehealth Available
                                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[9px] font-black uppercase tracking-widest rounded-full">Video & Chat</Badge>
                                        </p>
                                        <p className="text-[11px] font-bold text-muted-foreground">Same-day virtual visits covered by most plans</p>
                                    </div>
                                </div>
                                <Button className="h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-foreground text-background hover:bg-primary hover:text-white transition-all">
                                    <Users className="w-4 h-4 mr-2" /> In-Person Option
                                </Button>
                            </div>
                        </div>

                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-8">
                            <div className="flex items-center justify-between px-4">
                                <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Verified Patient Reviews
                                </h3>
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border/50 text-muted-foreground rounded-full">{doctor.reviews} Total</Badge>
                            </div>
                            <div className="space-y-5">
                                {reviews.map((r, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                                        className="p-8 rounded-[36px] bg-white/70 border border-border/40">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="w-11 h-11 rounded-[18px]">
                                                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-black text-sm tracking-tight">
                                                        {r.name.split(' ').map(n => n[0]).join('')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-black text-foreground tracking-tight">{r.name}</p>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        {[1,2,3,4,5].map(s => (
                                                            <Star key={s} className={cn("w-3 h-3", s <= r.rating ? "text-amber-500 fill-amber-500" : "text-border")} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{r.date}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground/80 leading-relaxed italic pl-4 border-l-2 border-primary/30">
                                            "{r.text}"
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <div className="p-10 rounded-[48px] bg-gradient-to-br from-foreground to-slate-900 text-background shadow-[0_40px_100px_rgba(0,0,0,0.25)] overflow-hidden relative group">
                            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-emerald-400/10 blur-3xl" />
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="w-14 h-14 rounded-[22px] bg-white/15 border border-white/20 flex items-center justify-center">
                                        <Stethoscope className="w-7 h-7" />
                                    </div>
                                    <Badge className="bg-white/15 border border-white/20 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                                        VIP Concierge
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black tracking-tighter leading-tight">Skip the waitlist</h3>
                                    <p className="text-sm font-semibold text-white/60 leading-relaxed">
                                        Premium members get priority booking, after-hours messaging, and direct video line to Dr. Chen.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        "Priority same-day slot access",
                                        "Secure after-hours direct line",
                                        "Unlimited secure messaging",
                                        "Partner + family included",
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                            <span className="text-sm font-semibold text-white/80 tracking-tight">{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <Button className="w-full h-16 rounded-[24px] bg-white text-foreground font-black text-[11px] uppercase tracking-[0.2em] hover:opacity-90 shadow-2xl gap-2">
                                    <Heart className="w-5 h-5" /> Unlock Premium
                                </Button>
                            </div>
                        </div>

                        <div className="glassmorphism p-10 rounded-[48px] border border-border/50 shadow-2xl space-y-6">
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] px-2">Similar Specialists</h3>
                            {[
                                { name: 'Dr. Michael Roberts', specialty: 'OB/GYN', rating: 4.8, avail: 'Tomorrow 10AM', av: 'MR', color: 'from-blue-500 to-indigo-600' },
                                { name: 'Dr. Emily Watson', specialty: 'Midwifery', rating: 5.0, avail: 'Thu 9:15 AM', av: 'EW', color: 'from-violet-500 to-purple-600' },
                            ].map((d, i) => (
                                <div key={i} className="p-5 rounded-[28px] bg-white/70 border border-border/40 hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="w-12 h-12 rounded-[18px] shrink-0">
                                            <AvatarFallback className={cn("bg-gradient-to-br text-white font-black text-sm tracking-tight", d.color)}>{d.av}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className="text-sm font-black text-foreground truncate tracking-tight">{d.name}</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-bold text-primary tracking-tight">{d.specialty}</span>
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                    <span className="text-[10px] font-black text-amber-700">{d.rating}</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Next: {d.avail}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
