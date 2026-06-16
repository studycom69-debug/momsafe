import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Activity, BellRing, LineChart,
  Brain, Apple, Pill, BookHeart, Settings,
  HeartPulse, LogOut, HelpCircle, Hospital,
  ChevronLeft, ChevronRight, User, Calendar, 
  ShieldCheck, Edit3, X, ExternalLink
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vitals", href: "/vitals", icon: Activity },
  { label: "Alerts", href: "/alerts", icon: BellRing, showBadge: true },
  { label: "Analytics", href: "/analytics", icon: LineChart },
  { label: "AI Guidance", href: "/ai-guidance", icon: Brain },
  { label: "Nutrition", href: "/nutrition", icon: Apple },
  { label: "Medication", href: "/medication", icon: Pill },
  { label: "Daily Logs", href: "/daily-logs", icon: BookHeart },
  { label: "Nearby Hospitals", href: "/hospitals", icon: Hospital },
];

const getTrimester = (week: number) => {
  if (week <= 12) return "First Trimester";
  if (week <= 26) return "Second Trimester";
  return "Third Trimester";
};

const calculateRiskStatus = (userData: any) => {
  if (!userData) return "Normal";
  const highRiskConditions = ["Hypertension", "Diabetes", "Preeclampsia", "Multiple Gestation"];
  const hasCondition = userData.conditions && highRiskConditions.some(c => userData.conditions.toLowerCase().includes(c.toLowerCase()));
  const isAdvancedAge = userData.age > 35;
  const isVeryYoung = userData.age < 18;
  
  if (hasCondition || isAdvancedAge || isVeryYoung) return "Needs Monitoring";
  return "Normal";
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      setUserData(data);
    } catch (err) {
      console.error("Error fetching user data for sidebar:", err);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .gte('created_at', tenMinutesAgo);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error("Error fetching unread alert count:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    fetchUserData();

    // Realtime subscription for unread count
    const channel = supabase
      .channel('sidebar-alerts-count')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'alerts',
        filter: `user_id=eq.${user?.id}`
      }, () => fetchUnreadCount())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount, fetchUserData, user?.id]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.error("Error signing out:", error.message);
    }
  };

  const displayName = userData?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "User";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const riskStatus = calculateRiskStatus(userData);

  return (
    <>
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 80 : 240 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-full bg-white border-r border-gray-100 flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      >
        {/* Logo Section */}
        <div className="px-4 h-20 flex items-center border-b border-gray-50 relative">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline group overflow-hidden">
            <motion.div 
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-200"
            >
              <HeartPulse className="w-5 h-5 text-white" />
            </motion.div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="whitespace-nowrap"
                >
                  <p className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">MomSafe AI</p>
                  <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest">Premium Care</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>

          {/* Collapse Toggle */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-md transition-all z-40"
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </div>

        {/* Profile Section */}
        <div className="px-3 py-6 border-b border-gray-50">
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full group flex items-center gap-3 p-2 rounded-2xl transition-all duration-200 ease-in-out hover:bg-gray-50 relative overflow-hidden"
          >
            <div className="relative flex-shrink-0">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <img 
                  src={avatarUrl} 
                  alt="" 
                  className="relative w-10 h-10 rounded-2xl object-cover bg-gray-100 border-2 border-white shadow-sm transition-transform" 
                  onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${displayName}&background=random`; }} 
                />
                {/* Status Dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${riskStatus === 'Normal' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </motion.div>
            </div>
            
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="min-w-0 text-left flex-1"
                >
                  <p className="text-sm font-black text-gray-900 truncate">{displayName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Week {userData?.gestational_week || "--"}</span>
                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{riskStatus}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto space-y-1.5 scrollbar-hide">
          {!isCollapsed && <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-3 mb-4">Core Navigation</p>}
          
          {NAV_ITEMS.map(({ label, href, icon: Icon, showBadge }) => {
            const active = location === href;
            const badge = (showBadge && unreadCount > 0) ? unreadCount : null;
            
            return (
              <Link key={href} href={href} className="block no-underline relative group">
                <motion.div 
                  initial={false}
                  whileHover="hover"
                  whileTap="tap"
                  className={`
                    flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ease-in-out relative overflow-hidden
                    ${active 
                      ? "bg-blue-50 text-blue-600 shadow-sm" 
                      : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
                    }
                  `}
                >
                  {/* Soft Background Highlight */}
                  <motion.div 
                    variants={{
                      hover: { opacity: 1 }
                    }}
                    initial={{ opacity: 0 }}
                    className="absolute inset-0 bg-blue-600/5 pointer-events-none"
                  />

                  {/* Active Indicator */}
                  {active && (
                    <motion.div 
                      layoutId="active-nav"
                      className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-600 rounded-r-full" 
                    />
                  )}

                  <motion.div 
                    variants={{
                      hover: { scale: 1.05, y: -2 },
                      tap: { scale: 0.95 }
                    }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={`relative z-10 ${active ? "text-blue-600" : "group-hover:text-blue-600"} transition-colors`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "stroke-[2.5px]" : ""}`} />
                    {badge !== null && isCollapsed && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                    )}
                  </motion.div>

                  {!isCollapsed && (
                    <motion.span 
                      variants={{
                        hover: { x: 2 }
                      }}
                      className={`relative z-10 text-sm font-bold tracking-tight ${active ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`}
                    >
                      {label}
                    </motion.span>
                  )}

                  {badge !== null && !isCollapsed && (
                    <span className="relative z-10 ml-auto text-[10px] font-black bg-red-500 text-white rounded-lg min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-lg shadow-red-100">
                      {badge}
                    </span>
                  )}

                  {/* Tooltip for Collapsed State */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 whitespace-nowrap shadow-xl">
                      {label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-gray-900" />
                    </div>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Footer Section */}
        <div className="p-3 border-t border-gray-50 space-y-1">
          {[
            { label: "Settings", href: "/settings", icon: Settings },
            { label: "Help", href: "/help", icon: HelpCircle },
          ].map(({ label, href, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href} className="block no-underline group relative">
                <motion.div 
                  initial={false}
                  whileHover="hover"
                  whileTap="tap"
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ease-in-out relative overflow-hidden ${active ? "bg-gray-100 text-gray-900 font-bold" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}
                >
                  {/* Soft Background Highlight */}
                  <motion.div 
                    variants={{
                      hover: { opacity: 1 }
                    }}
                    initial={{ opacity: 0 }}
                    className="absolute inset-0 bg-gray-900/5 pointer-events-none"
                  />

                  <motion.div
                    variants={{
                      hover: { scale: 1.05, y: -2 },
                      tap: { scale: 0.95 }
                    }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="relative z-10"
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "stroke-[2.5px]" : ""}`} />
                  </motion.div>
                  
                  {!isCollapsed && <span className="relative z-10 text-sm font-bold tracking-tight">{label}</span>}
                  
                  {isCollapsed && (
                    <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 whitespace-nowrap shadow-xl">
                      {label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-gray-900" />
                    </div>
                  )}
                </motion.div>
              </Link>
            );
          })}
          
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 ease-in-out group relative overflow-hidden"
          >
            <motion.div 
              initial={false}
              whileHover="hover"
              whileTap="tap"
              className="flex items-center gap-3 w-full"
            >
              {/* Soft Background Highlight */}
              <motion.div 
                variants={{
                  hover: { opacity: 1 }
                }}
                initial={{ opacity: 0 }}
                className="absolute inset-0 bg-red-500/5 pointer-events-none"
              />

              <motion.div
                variants={{
                  hover: { scale: 1.05, y: -2 },
                  tap: { scale: 0.95 }
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="relative z-10"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
              </motion.div>
              {!isCollapsed && <span className="relative z-10 text-sm font-bold tracking-tight">Sign out</span>}
            </motion.div>

            {isCollapsed && (
              <div className="absolute left-full ml-4 px-3 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 whitespace-nowrap shadow-xl">
                Sign out
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-red-600" />
              </div>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Profile Detail Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100"
            >
              {/* Modal Header/Banner */}
              <div className="relative h-32 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 flex flex-col justify-end">
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center gap-4">
                  <img 
                    src={avatarUrl} 
                    alt="" 
                    className="w-16 h-16 rounded-[1.5rem] border-4 border-white/20 shadow-xl object-cover bg-white" 
                    onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${displayName}&background=random`; }} 
                  />
                  <div>
                    <h3 className="text-lg font-black text-white leading-tight">{displayName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${riskStatus === 'Normal' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                      <span className="text-[10px] font-black text-blue-50 uppercase tracking-widest">System Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-50">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Pregnancy</p>
                    <p className="text-sm font-black text-blue-900">Week {userData?.gestational_week || "--"}</p>
                    <p className="text-[10px] font-bold text-blue-600/70 mt-0.5">{getTrimester(userData?.gestational_week || 0)}</p>
                  </div>
                  <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-50">
                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Due Date</p>
                    <p className="text-sm font-black text-purple-900">{userData?.due_date || "--"}</p>
                    <p className="text-[10px] font-bold text-purple-600/70 mt-0.5">Estimated Arrival</p>
                  </div>
                </div>

                <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shadow-sm ${riskStatus === 'Normal' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Health Status</p>
                      <p className={`text-sm font-black ${riskStatus === 'Normal' ? 'text-emerald-700' : 'text-amber-700'}`}>{riskStatus}</p>
                    </div>
                  </div>
                  <Link href="/alerts" onClick={() => setIsProfileModalOpen(false)}>
                    <ExternalLink className="w-4 h-4 text-gray-300 hover:text-blue-600 transition-colors" />
                  </Link>
                </div>

                <div className="flex gap-3 pt-2">
                  <Link href="/settings" onClick={() => setIsProfileModalOpen(false)} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all">
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Profile
                    </button>
                  </Link>
                  <button 
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

