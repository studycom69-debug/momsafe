"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Heart, Chrome, Activity, Brain, ShieldCheck } from "lucide-react"
import { motion } from "framer-motion"

export default function HomeRouterPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "fallback">("checking")
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      setError(error.message)
      setStatus("fallback")
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!mounted) return
        if (session) {
          router.replace("/dashboard")
          return
        }
        router.replace("/landing")
      } catch (err: any) {
        console.warn("[home] auth check failed, showing fallback", err)
        if (mounted) {
          setError(err?.message || null)
          setStatus("fallback")
        }
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === "fallback") {
    return <FallbackPage onSignIn={handleGoogleSignIn} error={error} />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-4 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
          <Heart className="w-10 h-10" fill="white" />
        </div>
        <div className="w-14 h-14 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 font-bold tracking-tight text-sm">
          Redirecting to MomSafe&hellip;
        </p>
        <button
          onClick={() => router.push("/landing")}
          className="text-emerald-600 text-xs font-black uppercase tracking-widest hover:underline mt-4"
        >
          Go to landing page &rarr;
        </button>
      </div>
    </div>
  )
}

function FallbackPage({
  onSignIn,
  error,
}: {
  onSignIn: () => void
  error: string | null
}) {
  const router = useRouter()
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 font-sans antialiased text-slate-900">
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/landing")}>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
            <Heart className="w-5 h-5" fill="white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black tracking-tighter">MomSafe</span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600/70">Premium Care</span>
          </div>
        </div>
        <button
          onClick={() => router.push("/landing")}
          className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors tracking-wide"
        >
          &larr; Back to landing
        </button>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
              <Activity className="w-3.5 h-3.5" />
              Protected Health Platform
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] mb-5">
              Welcome back.
            </h1>
            <p className="text-slate-500 font-semibold leading-relaxed tracking-tight">
              Sign in to your MomSafe dashboard to continue monitoring your pregnancy journey.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.12)] p-8 md:p-10 space-y-7"
          >
            <button
              onClick={onSignIn}
              className="w-full group bg-slate-900 hover:bg-slate-800 text-white px-6 py-5 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] transition-all duration-300 shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:shadow-slate-900/30 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-4"
            >
              <Chrome className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
              Continue with Google
            </button>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold p-4 rounded-2xl">
                {error}
              </div>
            )}

            <div className="relative flex items-center py-2">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="px-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                Why MomSafe
              </span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <div className="space-y-4">
              <TrustRow icon={ShieldCheck} title="HIPAA-Ready Security" desc="End-to-end encryption for all health data." />
              <TrustRow icon={Brain} title="AI-Powered Insights" desc="Clinical-grade pattern detection." />
              <TrustRow icon={Heart} title="24/7 Care Companion" desc="Real-time guidance every trimester." />
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

function TrustRow({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="mt-0.5 w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-50 group-hover:scale-110 transition-all duration-300 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-black tracking-tight text-slate-900">{title}</p>
        <p className="text-xs font-semibold leading-relaxed text-slate-500">{desc}</p>
      </div>
    </div>
  )
}
