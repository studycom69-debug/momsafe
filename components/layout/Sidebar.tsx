"use client"

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ClipboardList,
    Pill,
    Activity,
    Apple,
    ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
    href: string;
    label: string;
    icon: any;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ href, label, icon: Icon }) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group mb-1 border border-transparent",
                isActive
                    ? "bg-blue-600/5 text-blue-600 border-blue-600/10 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
        >
            <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300",
                isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "bg-slate-100 group-hover:bg-white group-hover:shadow-md"
            )}>
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
            </div>
            <span className={cn(
                "text-sm font-bold tracking-tight transition-colors",
                isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-900"
            )}>
                {label}
            </span>
            {isActive && (
                <div className="ml-auto">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                </div>
            )}
        </Link>
    );
};

interface SidebarProps {
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {

    return (
        <aside className={cn(
            "w-[280px] h-screen border-r border-slate-100 px-6 py-8 flex flex-col justify-between sticky top-0 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.02)]",
            className
        )}>
            <nav className="flex flex-col">
                <div className="mb-10 px-2 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-100">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none">
                            MomSafe
                        </h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pregnancy Care</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Your Health</p>
                    <SidebarItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
                    <SidebarItem href="/nutrition" label="Nutrition &amp; Diet" icon={Apple} />
                    <SidebarItem href="/health-log" label="Daily Logs" icon={ClipboardList} />
                    <SidebarItem href="/medication" label="Medications" icon={Pill} />
                    <SidebarItem href="/risk-history" label="Health Trends" icon={Activity} />
                </div>
            </nav>

            <div className="p-5 rounded-[22px] bg-blue-50 border border-blue-100 relative overflow-hidden group">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-blue-600/10 blur-2xl rounded-full" />
                <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-blue-700/70 uppercase tracking-widest">Account Secure</span>
                        </div>
                        <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-black text-slate-900 leading-tight">24/7 Support</p>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">You&apos;re in safe hands</p>
                        </div>
                    </div>
                    <button className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-100 transition-all">
                        Contact Care Team
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
