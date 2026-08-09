import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Heart } from "lucide-react";

const ANIM_STYLE = `
  .animated-ring-1 {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 480px;
    height: 480px;
    margin-left: -240px;
    margin-top: -240px;
    border: 1px solid rgba(176, 240, 214, 0.4);
    border-radius: 50%;
    animation: spin-slow 20s linear infinite;
  }
  .animated-ring-2 {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 520px;
    height: 520px;
    margin-left: -260px;
    margin-top: -260px;
    border: 1px solid rgba(176, 240, 214, 0.2);
    border-radius: 50%;
    animation: spin-slow-reverse 30s linear infinite;
  }
  .phone-mockup {
    box-shadow: 0 40px 80px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset;
  }
  .phone-notch {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 24px;
    background: black;
    border-radius: 12px;
    z-index: 30;
  }
  .ambient-shadow {
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 30px;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, transparent 70%);
    pointer-events: none;
  }
`;

export default function Login() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read ?redirect= from query string
  const redirect =
    new URLSearchParams(window.location.search).get("redirect") || "/dashboard";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted && session) {
          setLocation(redirect);
        }
      } catch (_) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [redirect, setLocation]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirect}`,
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
              <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-2 rounded-xl text-white shadow-lg shadow-emerald-500/20">
                <Heart className="w-4 h-4" fill="white" />
              </div>
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
        <div className="hidden md:flex flex-1 relative bg-white overflow-hidden items-center justify-center border-r border-md3-outline-variant/30">
          <div className="absolute top-0 left-0 right-0 px-8 py-6 z-30 flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => (window.location.href = "/landing.html")}
            >
              <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                <Heart className="w-5 h-5" fill="white" />
              </div>
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

          {/* Orbiting Cluster */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] flex items-center justify-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none z-0">
              <svg width="100%" height="100%" viewBox="0 0 700 700">
                <defs>
                  <radialGradient id="glow-new" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#F5C6D6" stopOpacity="0.8" />
                    <stop offset="60%" stopColor="#EAC9EE" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="350" cy="350" r="320" fill="url(#glow-new)" />
                <circle
                  cx="350"
                  cy="350"
                  r="230"
                  fill="none"
                  stroke="#C9B8D6"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                  opacity="0.55"
                />
                <circle
                  cx="350"
                  cy="350"
                  r="180"
                  fill="none"
                  stroke="#C9B8D6"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                  opacity="0.75"
                />
              </svg>
            </div>

            <div className="animated-ring-1" />
            <div className="animated-ring-2" />

            {/* Phone Mockup */}
            <div className="relative z-10 w-[280px] h-[580px] bg-black rounded-[48px] phone-mockup overflow-hidden p-2 border border-md3-outline-variant/30">
              <div className="w-full h-full bg-white rounded-[40px] relative overflow-hidden flex flex-col">
                <div className="phone-notch" />
                <div className="flex justify-between items-center px-6 pt-3 pb-1 z-20 text-[11px] font-medium text-black">
                  <span>9:41</span>
                  <div className="flex items-center space-x-1">
                    <span className="material-symbols-outlined text-[14px]">
                      signal_cellular_4_bar
                    </span>
                    <span className="material-symbols-outlined text-[14px]">
                      wifi
                    </span>
                    <span className="material-symbols-outlined text-[14px]">
                      battery_full
                    </span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col px-6 pt-16 pb-8 z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[10px] text-md3-on-surface-variant/70 font-medium">
                        Good morning,
                      </p>
                      <h3 className="text-lg font-bold text-md3-on-surface">
                        Helen
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-md3-primary-fixed flex items-center justify-center border border-md3-outline-variant/30">
                      <span className="material-symbols-outlined text-md3-primary text-xl">
                        person
                      </span>
                    </div>
                  </div>
                  <div className="bg-md3-surface-container-low rounded-3xl p-4 mb-6 flex items-center space-x-4 border border-md3-outline-variant/20">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-md3-outline-variant/20"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="175.9"
                          strokeDashoffset="14"
                          className="text-md3-primary"
                        />
                      </svg>
                      <span className="absolute text-sm font-bold text-md3-primary">
                        92
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-md3-on-surface">
                        Proactive Health Score
                      </p>
                      <p className="text-[10px] text-md3-on-surface-variant/70">
                        Excellent condition today
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-md3-outline-variant/30 rounded-2xl p-3 space-y-1">
                      <div className="flex items-center space-x-1 text-md3-primary">
                        <span className="material-symbols-outlined text-sm">
                          favorite
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Vitals
                        </span>
                      </div>
                      <div className="text-lg font-bold">
                        72{" "}
                        <span className="text-[10px] font-normal text-md3-on-surface-variant">
                          BPM
                        </span>
                      </div>
                    </div>
                    <div className="bg-white border border-md3-outline-variant/30 rounded-2xl p-3 space-y-1">
                      <div className="flex items-center space-x-1 text-md3-secondary">
                        <span className="material-symbols-outlined text-sm">
                          bedtime
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Sleep
                        </span>
                      </div>
                      <div className="text-lg font-bold">7h 42m</div>
                    </div>
                  </div>
                  <div className="mt-auto flex justify-center w-full">
                    <div className="w-1/3 h-1 bg-md3-on-surface/20 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="ambient-shadow" />
            </div>
          </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-10 sm:px-12 lg:px-24">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center sm:text-left space-y-4">
              <div className="flex items-center justify-center sm:justify-start space-x-2 text-md3-primary">
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  local_hospital
                </span>
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
                  Welcome to MomSafe AI. Enter your credentials to continue
                  monitoring your health safely.
                </p>
              </div>
            </div>

            <div className="space-y-6 mt-8">
              <div className="pt-4">
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
                    {loading ? "Signing you in..." : "Sign in with Google"}
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
                <span className="text-md3-primary font-medium hover:underline cursor-pointer">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="text-md3-primary font-medium hover:underline cursor-pointer">
                  Privacy Policy
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
