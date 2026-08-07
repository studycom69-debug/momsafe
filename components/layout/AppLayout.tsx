import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { Bell, Settings } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface AppLayoutProps {
    children: React.ReactNode;
    user?: SupabaseUser | null | { name: string };
    unreadCount?: number;
    className?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
    children,
    unreadCount = 0,
    className = ''
}) => {
    const router = useRouter()
    const [verified, setVerified] = useState(false)
    const [user, setUser] = useState<SupabaseUser | null>(null)

    useEffect(() => {
        let mounted = true
        ;(async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!mounted) return
            if (!session) {
                router.push('/login')
                return
            }
            setUser(session.user)
            setVerified(true)
        })()
        return () => { mounted = false }
    }, [router])

    if (!verified) return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-sans">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
    )

    const displayName = (user as any)?.name || (user as any)?.email?.split('@')[0] || 'User';
    const displayInitial = displayName?.[0]?.toUpperCase() || 'U';

    return (
        <div className={`flex min-h-screen bg-[#F8FAFC] font-sans antialiased text-[#1E293B] ${className}`}>
            <Sidebar className="hidden lg:flex" />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 flex items-center justify-between px-6 md:px-8 border-b border-slate-100 bg-white">
                    <Sidebar className="lg:hidden" />
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="relative">
                            <button className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all">
                                <Bell className="w-5 h-5" />
                            </button>
                            {unreadCount > 0 && (
                                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                                    {unreadCount}
                                </div>
                            )}
                        </div>
                        <button className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all">
                            <Settings className="w-5 h-5" />
                        </button>

                        <div className="h-8 w-px bg-slate-100 mx-1 md:mx-2" />

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900 truncate leading-none mb-0.5">
                                    {displayName}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                    MomSafe User
                                </p>
                            </div>
                            <Avatar className="w-9 h-9 border border-slate-100 shadow-sm">
                                <AvatarFallback className="bg-blue-50 text-blue-700 text-xs font-bold uppercase">
                                    {displayInitial}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden p-6 md:p-8">
                    <div className="max-w-[1440px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
