import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Heart } from "lucide-react";

const ANIM_STYLE = `
  .tablet-float {
    animation: floatY 6s ease-in-out infinite;
    transform-style: preserve-3d;
  }
  @keyframes floatY {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }
  .tablet-mockup {
    box-shadow:
      0 60px 120px -30px rgba(0,0,0,0.35),
      0 30px 60px -20px rgba(0,0,0,0.22),
      0 8px 24px -8px rgba(0,0,0,0.18);
  }
  .heart-beat {
    animation: heartBeat 1.2s ease-in-out infinite;
    transform-origin: center;
  }
  @keyframes heartBeat {
    0%, 100% { transform: scale(1); }
    14%      { transform: scale(1.28); }
    28%      { transform: scale(1); }
    42%      { transform: scale(1.2); }
    70%      { transform: scale(1); }
  }
  .number-tick {
    animation: tickerSwap 4s ease-in-out infinite;
  }
  @keyframes tickerSwap {
    0%, 42%, 100% { opacity: 1; }
    48%           { opacity: 0; transform: translateY(-3px); }
    54%           { opacity: 0; transform: translateY(3px); }
    60%           { opacity: 1; transform: translateY(0); }
  }
  .wearable-dot {
    position: relative;
  }
  .wearable-dot::after {
    content: "";
    position: absolute;
    inset: -3px;
    border-radius: 9999px;
    background: rgba(16,185,129,0.35);
    animation: dotPulse 1.8s ease-in-out infinite;
  }
  @keyframes dotPulse {
    0%   { transform: scale(0.8); opacity: 0.8; }
    70%  { transform: scale(2.2); opacity: 0; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  .sparkline-draw path {
    stroke-dasharray: 160;
    stroke-dashoffset: 0;
    animation: drawLine 3.2s cubic-bezier(.4,0,.2,1) infinite;
  }
  @keyframes drawLine {
    0%   { stroke-dashoffset: 160; }
    60%  { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: 0; }
  }
  .wearable-sync-shimmer {
    background: linear-gradient(90deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.55) 50%, rgba(16,185,129,0) 100%);
    background-size: 200% 100%;
    animation: synchShim 2.4s linear infinite;
  }
  @keyframes synchShim {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  .slide-in-feed > * {
    opacity: 0;
    transform: translateX(-12px);
    animation: feedSlideIn 9s ease-in-out infinite;
  }
  .slide-in-feed > *:nth-child(1) { animation-delay: 0s; }
  .slide-in-feed > *:nth-child(2) { animation-delay: 1.5s; }
  .slide-in-feed > *:nth-child(3) { animation-delay: 3s; }
  @keyframes feedSlideIn {
    0%, 5%   { opacity: 0; transform: translateX(-12px); }
    18%, 90% { opacity: 1; transform: translateX(0); }
    95%, 100% { opacity: 0.95; }
  }
  .check-pop {
    animation: popCheck 1.8s ease-out infinite;
  }
  @keyframes popCheck {
    0%, 10%  { transform: scale(0); opacity: 0; }
    40%, 90% { transform: scale(1); opacity: 1; }
  }
  .sync-dot {
    animation: syncFlash 1.6s ease-in-out infinite;
  }
  @keyframes syncFlash {
    0%, 100% { opacity: 0.3; }
    50%      { opacity: 1; }
  }
  .macro-bar-fill {
    animation: barGrow 1.5s cubic-bezier(.25,.46,.45,.94) forwards;
    transform-origin: left;
  }
  @keyframes barGrow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
`;

export default function Login() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [hasCompletedProfile, setHasCompletedProfile] = useState<boolean>(false);

  // Read ?redirect= from query string
  const redirect =
    new URLSearchParams(window.location.search).get("redirect") || "/dashboard";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        sessionStorage.removeItem("momsafe_skip_onboarding");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
          });
          const { data: profile } = await supabase
            .from("users")
            .select("full_name")
            .eq("id", session.user.id)
            .maybeSingle();
          if (mounted) {
            setHasCompletedProfile(Boolean(profile?.full_name));
          }
        }
      } catch (_) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      // Clear local session first so the user can switch or re-authenticate cleanly
      await supabase.auth.signOut({ scope: "local" });
    } catch (_) {}

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirect || "/dashboard"}`,
          queryParams: {
            prompt: "select_account",
            access_type: "offline",
          },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (e: any) {
      setError(e?.message || "Sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleContinueCurrent = () => {
    if (hasCompletedProfile) {
      setLocation(redirect || "/dashboard");
    } else {
      window.location.href = "/onboarding";
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setHasCompletedProfile(false);
    } catch (e: any) {
      setError(e?.message || "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;600&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLE }} />

      <div className="min-h-screen bg-white text-md3-on-background flex flex-col md:flex-row md:overflow-hidden font-body-md antialiased w-full">
        {/* Top nav (mobile) */}
        <nav className="w-full px-6 py-5 md:hidden">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => (window.location.href = "/landing.html")}
            >
              <img
                src="/favicon.svg"
                alt="MomSafe AI"
                className="w-8 h-8 rounded-xl object-contain shadow-xs"
              />
              <span className="text-lg font-black tracking-tighter">
                MomSafe
              </span>
            </div>
            <button
              onClick={() => (window.location.href = "/landing.html")}
              className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors tracking-wide"
            >
              ← Back
            </button>
          </div>
        </nav>

        {/* Left Panel: Visuals & Branding */}
        <div
          className="hidden md:flex flex-1 relative overflow-hidden items-center justify-center border-r border-md3-outline-variant/30"
          style={{
            background: [
              'radial-gradient(ellipse 70% 55% at 30% 35%, rgba(245, 232, 248, 0.75) 0%, transparent 60%)',
              'radial-gradient(ellipse 60% 50% at 75% 70%, rgba(226, 248, 240, 0.70) 0%, transparent 60%)',
              'linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%)',
            ].join(', '),
          }}
        >
          <div className="absolute top-0 left-0 right-0 px-8 py-6 z-30 flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => (window.location.href = "/landing.html")}
            >
              <img
                src="/favicon.svg"
                alt="MomSafe AI"
                className="w-10 h-10 rounded-2xl object-contain shadow-xs"
              />
              <div className="flex flex-col leading-none">
                <span className="text-xl font-black tracking-tighter">
                  MomSafe
                </span>
              </div>
            </div>
            <button
              onClick={() => (window.location.href = "/landing.html")}
              className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors tracking-wide"
            >
              ← Back to landing
            </button>
          </div>

          {/* Abstract Line Art */}
          <svg
            className="absolute top-0 left-0 w-64 h-64 text-md3-outline-variant/30 pointer-events-none"
            fill="none"
            viewBox="0 0 200 200"
          >
            <path
              d="M-20,50 Q40,80 80,20 T150,-30"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <path
              d="M-10,120 C50,150 90,80 160,100"
              fill="none"
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle cx="40" cy="40" fill="currentColor" r="4" />
            <circle cx="120" cy="80" fill="currentColor" r="2" />
          </svg>
          <svg
            className="absolute bottom-0 right-0 w-64 h-64 text-md3-outline-variant/30 pointer-events-none transform rotate-180"
            fill="none"
            viewBox="0 0 200 200"
          >
            <path
              d="M-20,50 Q40,80 80,20 T150,-30"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <path
              d="M-10,120 C50,150 90,80 160,100"
              fill="none"
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle cx="40" cy="40" fill="currentColor" r="4" />
            <circle cx="120" cy="80" fill="currentColor" r="2" />
          </svg>


          {/* Tablet Mockup — fills the panel */}
          <div className="absolute inset-0 flex items-center justify-center p-10 pt-20 pb-10">
            <div className="tablet-float w-full h-full max-w-[900px] max-h-[620px] relative">
              {/* Tablet Frame — solid black bezel */}
              <div
                className="tablet-mockup relative w-full h-full rounded-[24px] bg-black overflow-hidden flex flex-col"
                style={{ padding: '14px' }}
              >
                {/* Camera dot (top center, inside the bezel) */}
                <div
                  className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full z-30"
                  style={{ background: 'radial-gradient(circle at 35% 35%, #3a3d42 0%, #0a0b0d 70%, #000 100%)' }}
                />

                {/* Inner Screen */}
                <div className="relative flex-1 rounded-[12px] overflow-hidden bg-gradient-to-br from-[#f8fafb] via-white to-[#f0faf5] flex flex-col">

                  {/* Status Bar */}
                  <div className="flex justify-between items-center px-5 py-2.5 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-1.5 rounded-xl text-white shadow-md shadow-emerald-500/25">
                        <Heart className="w-3.5 h-3.5" fill="white" />
                      </div>
                      <span className="font-black tracking-tight text-[14px] text-slate-900">MomSafe Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-semibold">
                      <span>Tuesday, Oct 1 &middot; 9:41 AM</span>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">wifi</span>
                        <span className="material-symbols-outlined text-[16px]">battery_full</span>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Content — 2 col × 3 row grid */}
                  <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-3 p-4 min-h-0 overflow-hidden">

                    {/* Card 1: Greeting + Quick Summary */}
                    <div className="row-span-1 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-100/80 p-4 flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[20px] font-black text-slate-900 tracking-tight leading-tight">Good morning,</div>
                            <div className="text-[20px] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-teal-500 tracking-tight">Helen.</div>
                          </div>
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0">
                            <span className="material-symbols-outlined text-slate-600 text-[22px]">account_circle</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1.5 font-medium">Week 24 &middot; 2nd Trimester &middot; Day 168</div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <div className="flex-1 bg-white/80 rounded-xl px-3 py-2 border border-emerald-100/60">
                          <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Next Checkup</div>
                          <div className="text-[13px] font-black text-slate-800 mt-0.5">Oct 8</div>
                        </div>
                        <div className="flex-1 bg-white/80 rounded-xl px-3 py-2 border border-emerald-100/60">
                          <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Due Date</div>
                          <div className="text-[13px] font-black text-slate-800 mt-0.5">Jan 14</div>
                        </div>
                        <div className="flex-1 bg-white/80 rounded-xl px-3 py-2 border border-emerald-100/60">
                          <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Days Left</div>
                          <div className="text-[13px] font-black text-emerald-700 mt-0.5">105</div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Live Vitals */}
                    <div className="row-span-1 rounded-2xl bg-gradient-to-br from-rose-50 via-white to-emerald-50 border border-rose-100/70 p-4 flex flex-col overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 -translate-y-6 translate-x-8 rounded-full bg-rose-200/25 blur-2xl pointer-events-none" />
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="heart-beat">
                            <Heart className="w-4 h-4 text-rose-500" fill="#f43f5e" />
                          </span>
                          <span className="text-[12px] font-black text-rose-700 tracking-wide uppercase">Live Vitals</span>
                          <span className="wearable-dot ml-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
                          <span className="material-symbols-outlined text-[11px]">watch</span>
                          MomSafe Wearable streaming
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-3 relative z-10">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="number-tick text-[28px] font-black text-rose-700 leading-none">78</span>
                            <span className="text-[11px] font-bold text-rose-500">bpm</span>
                          </div>
                          <div className="text-[10px] text-rose-500/80 font-semibold">Heart Rate</div>
                        </div>
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="number-tick text-[28px] font-black text-sky-700 leading-none">98</span>
                            <span className="text-[11px] font-bold text-sky-500">%</span>
                          </div>
                          <div className="text-[10px] text-sky-500/80 font-semibold">SpO₂ Oxygen</div>
                        </div>
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="number-tick text-[28px] font-black text-violet-700 leading-none">112/74</span>
                          </div>
                          <div className="text-[10px] text-violet-500/80 font-semibold">Blood Pressure</div>
                        </div>
                      </div>

                      {/* Sparkline chart */}
                      <div className="flex-1 min-h-0 mt-2 sparkline-draw relative z-10">
                        <svg viewBox="0 0 600 120" className="w-full h-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.6" />
                              <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="30" x2="600" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 5" />
                          <line x1="0" y1="60" x2="600" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 5" />
                          <line x1="0" y1="90" x2="600" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 5" />
                          <path
                            d="M0,85 C60,50 110,90 170,65 S280,20 340,55 S460,100 520,40 S580,70 600,50 L600,120 L0,120 Z"
                            fill="url(#sparkFill)"
                          />
                          <path
                            d="M0,85 C60,50 110,90 170,65 S280,20 340,55 S460,100 520,40 S580,70 600,50"
                            fill="none"
                            stroke="url(#sparkStroke)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <circle cx="600" cy="50" r="4" fill="#10b981" stroke="white" strokeWidth="2" />
                        </svg>
                      </div>
                    </div>

                    {/* Card 3: Nutrition — Daily Macro Breakdown */}
                    <div className="row-span-1 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-100/80 p-4 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-600 text-[18px]">restaurant</span>
                          <span className="text-[12px] font-black text-amber-800 tracking-wide uppercase">Nutrition</span>
                        </div>
                        <span className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">trending_up</span>
                          On Track
                        </span>
                      </div>

                      {/* Calorie ring + macros */}
                      <div className="flex gap-4 mt-3 flex-1 min-h-0">
                        {/* Calorie ring */}
                        <div className="flex flex-col items-center justify-center flex-shrink-0">
                          <div className="relative w-[80px] h-[80px]">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="40" fill="none" stroke="#fde68a" strokeWidth="10" />
                              <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="10" strokeDasharray="251.3" strokeDashoffset="40" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="number-tick text-[18px] font-black text-amber-800 leading-none">1,850</span>
                              <span className="text-[9px] font-semibold text-amber-600">/ 2,200</span>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-amber-700 mt-1">Calories</span>
                        </div>

                        {/* Macro bars */}
                        <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
                          {[
                            { label: 'Protein', value: 72, max: 95, color: 'from-rose-400 to-rose-500', bg: 'bg-rose-100', text: 'text-rose-700', unit: 'g' },
                            { label: 'Carbs', value: 240, max: 300, color: 'from-sky-400 to-sky-500', bg: 'bg-sky-100', text: 'text-sky-700', unit: 'g' },
                            { label: 'Fats', value: 58, max: 75, color: 'from-amber-400 to-amber-500', bg: 'bg-amber-100', text: 'text-amber-700', unit: 'g' },
                            { label: 'Iron', value: 22, max: 27, color: 'from-emerald-400 to-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', unit: 'mg' },
                          ].map((m) => (
                            <div key={m.label} className="flex items-center gap-2.5">
                              <span className={`text-[10px] font-bold ${m.text} w-[40px] text-right`}>{m.label}</span>
                              <div className={`flex-1 h-[8px] ${m.bg} rounded-full overflow-hidden`}>
                                <div
                                  className={`macro-bar-fill h-full bg-gradient-to-r ${m.color} rounded-full`}
                                  style={{ width: `${(m.value / m.max) * 100}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold ${m.text} w-[45px]`}>{m.value}{m.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Today's Care Plan */}
                    <div className="row-span-1 rounded-2xl bg-white border border-slate-200/80 p-4 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-violet-700 text-[18px]">medication</span>
                          <span className="text-[12px] font-black text-slate-800 tracking-tight">Today's Care Plan</span>
                        </div>
                        <div className="flex gap-0.5">
                          <div className="sync-dot w-1.5 h-1.5 rounded-full bg-violet-500" style={{ animationDelay: '0s' }} />
                          <div className="sync-dot w-1.5 h-1.5 rounded-full bg-violet-500" style={{ animationDelay: '0.2s' }} />
                          <div className="sync-dot w-1.5 h-1.5 rounded-full bg-violet-500" style={{ animationDelay: '0.4s' }} />
                        </div>
                      </div>
                      <div className="slide-in-feed flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
                        {/* Prenatal vitamin — done */}
                        <div className="flex items-center gap-2.5 bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100">
                          <div className="check-pop w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-400/30">
                            <span className="material-symbols-outlined text-white text-[16px]">check</span>
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="text-[12px] font-bold text-slate-800">Prenatal multivitamin</div>
                            <div className="text-[10px] text-slate-500">1 tab &middot; w/ breakfast</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[10px] font-bold text-emerald-600">8:00 AM</div>
                            <div className="text-[9px] text-emerald-500 font-semibold flex items-center justify-end gap-0.5">
                              <span className="material-symbols-outlined text-[9px]">check_circle</span>
                              Done
                            </div>
                          </div>
                        </div>
                        {/* Folic acid — next */}
                        <div className="flex items-center gap-2.5 bg-violet-50/50 rounded-xl p-2.5 border-2 border-violet-200">
                          <div className="w-8 h-8 rounded-xl border-2 border-violet-300 flex items-center justify-center flex-shrink-0 bg-white">
                            <div className="w-2.5 h-2.5 rounded-full bg-violet-500 wearable-dot" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="text-[12px] font-bold text-slate-800">Folic acid 400 mcg</div>
                            <div className="text-[10px] text-slate-500">Neural tube support</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[10px] font-bold text-violet-700">1:00 PM</div>
                            <div className="text-[9px] text-violet-500 font-semibold">
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold text-[8px]">Next</span>
                            </div>
                          </div>
                        </div>
                        {/* Dr. appointment */}
                        <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-slate-200">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-400/30">
                            <span className="material-symbols-outlined text-white text-[16px]">event_available</span>
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="text-[12px] font-bold text-slate-800">Dr. Kapoor — check-in</div>
                            <div className="text-[10px] text-slate-500">Glucose + 24w review</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[10px] font-bold text-emerald-700">2:30 PM</div>
                            <div className="text-[9px] text-emerald-500 font-semibold flex items-center justify-end gap-0.5">
                              <span className="material-symbols-outlined text-[9px]">video_call</span>
                              Link ready
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 5: MomSafe Wearable Sync */}
                    <div className="row-span-1 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-200/70 p-4 flex flex-col overflow-hidden relative">
                      <div className="absolute inset-0 wearable-sync-shimmer opacity-25 pointer-events-none rounded-2xl" />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                          <Heart className="w-5 h-5 text-white" fill="white" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="text-[13px] font-black text-slate-800 leading-tight">MomSafe Wearable</div>
                          <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 wearable-dot" />
                            Connected &middot; Live sync
                          </div>
                        </div>
                        <span className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-200/80">Active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 relative z-10 flex-1 min-h-0">
                        {[
                          { val: '98%', label: 'Battery', color: 'text-emerald-700' },
                          { val: '5.2k', label: 'Steps', color: 'text-sky-700' },
                          { val: '142', label: 'Calories', color: 'text-rose-600' },
                          { val: '24°C', label: 'Skin Temp', color: 'text-violet-700' },
                        ].map((s) => (
                          <div key={s.label} className="bg-white/80 rounded-xl p-2.5 text-center border border-emerald-100/60 flex flex-col items-center justify-center">
                            <div className={`text-[14px] font-black ${s.color} leading-none`}>{s.val}</div>
                            <div className="text-[8px] text-slate-500 font-semibold mt-1 uppercase tracking-wider">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-0.5 mt-2.5 justify-center relative z-10">
                        {[0, 0.12, 0.24, 0.36, 0.48].map((d, i) => (
                          <div key={i} className="sync-dot w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </div>

                    {/* Card 6: Pregnancy Risk Score */}
                    <div className="row-span-1 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200/70 p-4 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-700 text-[18px]">health_and_safety</span>
                          <span className="text-[12px] font-black text-emerald-800 tracking-wide uppercase">Pregnancy Risk</span>
                        </div>
                        <span className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-400/40">Low Risk</span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 flex-1 min-h-0">
                        {/* Big number */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="flex items-end gap-0.5">
                            <span className="number-tick text-[42px] font-black text-emerald-800 leading-none">2.1</span>
                            <span className="text-[16px] font-bold text-emerald-700 mb-1.5">%</span>
                          </div>
                          <div className="text-[10px] text-emerald-700/85 font-semibold mt-1">Stable across 14 biomarkers</div>
                        </div>
                        {/* Progress bars */}
                        <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
                          <div>
                            <div className="flex justify-between text-[9px] font-semibold text-emerald-700/80 mb-1">
                              <span>Overall Risk</span><span>14%</span>
                            </div>
                            <div className="h-2.5 w-full bg-emerald-200/70 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-sm shadow-emerald-400/50" style={{ width: '14%' }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] font-semibold text-emerald-700/70 mb-1">
                              <span>Trimester Progress</span><span>60%</span>
                            </div>
                            <div className="h-2.5 w-full bg-emerald-200/70 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full" style={{ width: '60%' }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] font-semibold text-emerald-700/70 mb-1">
                              <span>Vitals Score</span><span>92%</span>
                            </div>
                            <div className="h-2.5 w-full bg-emerald-200/70 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-400 to-green-400 rounded-full" style={{ width: '92%' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-10 sm:px-12 lg:px-24">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center sm:text-left space-y-4">
              <div className="flex items-center justify-center sm:justify-start space-x-3 text-md3-primary">
                <img
                  src="/favicon.svg"
                  alt="MomSafe AI"
                  className="w-9 h-9 rounded-xl object-contain shadow-xs shrink-0"
                />
                <h1 className="font-headline-md text-2xl font-bold tracking-tight">
                  MomSafe AI
                </h1>
              </div>
              <p className="text-label-caps text-xs text-md3-tertiary-container uppercase tracking-wider font-semibold">
                Protecting Every Heartbeat
              </p>
              <div className="pt-6">
                <h2 className="font-headline-lg-mobile md:font-headline-lg text-[40px] leading-[48px] text-md3-on-surface mb-2 font-bold tracking-[-0.02em]">
                  Sign In
                </h2>
                <p className="text-body-md text-md3-on-surface-variant">
                  Welcome to MomSafe AI. Choose an account to continue monitoring your health safely.
                </p>
              </div>
            </div>

            <div className="space-y-6 mt-8">
              {currentUser?.email ? (
                <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-slate-800 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 tracking-wider uppercase">
                      Current Session
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={loading}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                      {currentUser.email.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {currentUser.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {hasCompletedProfile
                          ? "Onboarding completed"
                          : "Setup not finished yet"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueCurrent}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                  >
                    Continue as {currentUser.email.split("@")[0]}
                  </button>
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 bg-white border border-md3-outline-variant/50 rounded-full shadow-sm hover:bg-md3-surface-container-low transition-all duration-300 transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="font-semibold text-black text-body-md">
                    {loading
                      ? "Connecting..."
                      : currentUser
                      ? "Sign in with a different Google account"
                      : "Sign in with Google"}
                  </span>
                </button>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold p-4 rounded-2xl">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-8 space-y-8">
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-md3-outline-variant/20">
                <div className="flex items-center space-x-3 text-md3-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-md3-primary text-xl"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    monitoring
                  </span>
                  <span className="text-body-sm">
                    Real-time vitals monitoring
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-md3-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-md3-primary text-xl"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    notifications_active
                  </span>
                  <span className="text-body-sm">Instant family alerts</span>
                </div>
                <div className="flex items-center space-x-3 text-md3-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-md3-primary text-xl"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    verified_user
                  </span>
                  <span className="text-body-sm">
                    Trusted by healthcare professionals
                  </span>
                </div>
              </div>
              <p className="text-center text-[11px] text-md3-on-surface-variant/70 px-4">
                By continuing, you agree to our{" "}
                <a
                  href="/terms.html"
                  className="text-md3-primary font-medium hover:underline cursor-pointer"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy.html"
                  className="text-md3-primary font-medium hover:underline cursor-pointer"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
