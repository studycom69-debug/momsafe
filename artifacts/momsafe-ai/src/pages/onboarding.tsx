import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  Heart,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Check,
  Lock,
  Baby,
  HelpCircle,
  LogOut,
  FileText,
  Zap,
  Info,
  CheckCircle2,
  Clock,
  X,
  Stethoscope,
  Building2,
  User,
  Phone,
  Minus,
  Plus,
} from "lucide-react";

function validateName(name: string): string | null {
  const v = name.trim();
  if (!v) return "Please enter your full name";
  if (v.length < 2) return "Name must be at least 2 characters";
  if (v.length > 80) return "Name must be under 80 characters";
  if (/\d/.test(v)) return "Name should not contain numbers";
  const bad = /(.)\1{3,}/;
  if (bad.test(v)) return "Name looks invalid (too many repeated characters)";
  const re = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-\s.]{1,79}$/;
  if (!re.test(v)) return "Please enter letters only";
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "Please enter first and last name";
  return null;
}

function validateAge(age: string): string | null {
  if (!age) return null;
  const n = Number(age);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Age must be a whole number";
  if (n < 16) return "Age must be at least 16";
  if (n > 55) return "Age must be 55 or under";
  return null;
}

function calculateDueDateFromWeek(currentWeek: number): {
  dueDateStr: string;
  formattedDate: string;
  daysRemaining: number;
} {
  const safeWeek = Math.max(1, Math.min(42, currentWeek));
  const remainingWeeks = 40 - safeWeek;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + remainingWeeks * 7);

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dd = String(targetDate.getDate()).padStart(2, "0");
  const dueDateStr = `${yyyy}-${mm}-${dd}`;

  const formattedDate = targetDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const diffTime = targetDate.getTime() - new Date().getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  return { dueDateStr, formattedDate, daysRemaining };
}

function getWeekMilestone(week: number): string {
  if (week <= 8) return "Early embryonic stage: Vital organs and neural tube forming.";
  if (week <= 12) return "End of 1st Trimester: Baby's heartbeat is clearly detectable.";
  if (week <= 16) return "Week 16: Rapid growth, baby's facial expressions developing.";
  if (week <= 20) return "Week 20: Mid-pregnancy anatomy scan milestone; first kicks felt.";
  if (week <= 24) return "Week 24: Baby's hearing formed; lungs producing surfactant.";
  if (week <= 28) return "Week 28: Third trimester begins; baby opens eyes and recognizes maternal voice.";
  if (week <= 32) return "Week 32: Rapid bone ossification; baby practicing breathing motions.";
  if (week <= 36) return "Week 36: Baby descending into pelvic cradle; preparing for delivery.";
  return "Weeks 37–40: Full term. Lungs and vitals mature for labor.";
}

const INDIAN_CONDITIONS = [
  "Gestational Diabetes (GDM)",
  "Pre-eclampsia / High BP",
  "Pregnancy Anemia (Low Hb)",
  "Thyroid (TSH Imbalance)",
  "Gestational Hypertension",
  "PCOS / PCOD History",
  "Asthma / Respiratory",
  "None of the above",
];

const INDIAN_ALLERGIES = [
  "Penicillin & Cephalosporins",
  "Sulfa Antibiotics",
  "Paracetamol / NSAIDs",
  "Peanuts & Tree Nuts",
  "Dairy / Cow's Milk",
  "Soy / Gluten",
  "Latex Sensitivity",
  "No Known Drug Allergies",
];

const INDIAN_DIETS = [
  {
    id: "gdm_friendly",
    title: "Gestational Diabetic (Low GI)",
    desc: "Millets (Ragi, Jowar), high-fiber pulses, sprouted daals, and regulated carb timing to stabilize glucose.",
    badge: "FOGSI & ICMR Aligned",
  },
  {
    id: "lacto_vegetarian",
    title: "Indian Pure Vegetarian",
    desc: "Paneer, curd, seasonal leafy greens, lentils, with fortified vitamin B12 and iron supplementation support.",
    badge: "High Bioavailability",
  },
  {
    id: "sattvic_jain",
    title: "Sattvic / Jain Friendly",
    desc: "Wholesome grains, nuts, dairy, and seeds prepared without underground roots for light and balanced digestion.",
    badge: "Gentle Digestion",
  },
  {
    id: "balanced_nonveg",
    title: "Eggetarian / High Protein",
    desc: "Farm eggs, fresh steamed fish, lean poultry broth, and green vegetables for optimal fetal growth.",
    badge: "DHA & Protein Rich",
  },
];

interface OnboardingProps {
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps = {}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [originalNotes, setOriginalNotes] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [lastSavedTime, setLastSavedTime] = useState<string>("Just now");
  const [activeModal, setActiveModal] = useState<"dpdp" | "fogsi" | "emergency108" | "help" | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    age: "28",
    gestational_week: 24,
    doctor_name: "Dr. Priya Sharma, MD",
    hospital: "Cloudnine Hospital, Bengaluru",
    guardian_name: "Rahul Sharma",
    guardian_relationship: "Husband",
    guardian_phone: "+91 98765 43210",
    dietary_preference: "gdm_friendly",
    notes: "",
    enable_telemetry: true,
  });

  const [selectedConditions, setSelectedConditions] = useState<string[]>([
    "Gestational Diabetes (GDM)",
  ]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([
    "Penicillin & Cephalosporins",
  ]);

  const { dueDateStr, formattedDate, daysRemaining } = useMemo(
    () => calculateDueDateFromWeek(form.gestational_week),
    [form.gestational_week]
  );

  const trimester = useMemo(() => {
    if (form.gestational_week >= 28) return "Third Trimester";
    if (form.gestational_week >= 13) return "Second Trimester";
    return "First Trimester";
  }, [form.gestational_week]);

  const progressPercent = useMemo(
    () => Math.min(100, Math.max(5, Math.round((form.gestational_week / 40) * 100))),
    [form.gestational_week]
  );

  const errors = {
    full_name: validateName(form.full_name),
    age: validateAge(form.age),
  };

  // If user already has a completed profile, redirect to dashboard
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("full_name, onboarding_completed, gestational_week, doctor_name, hospital")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.onboarding_completed && data?.full_name) {
        if (onComplete) onComplete();
        window.location.href = "/dashboard";
      } else if (data?.full_name && !form.full_name) {
        setForm((f) => ({
          ...f,
          full_name: data.full_name || "",
          gestational_week: data.gestational_week || 24,
          doctor_name: data.doctor_name || f.doctor_name,
          hospital: data.hospital || f.hospital,
        }));
      }
    })();
  }, [user, onComplete]);

  useEffect(() => {
    const timer = setInterval(() => setLastSavedTime("1m ago"), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleCondition = (item: string) => {
    if (item === "None of the above") {
      setSelectedConditions(["None of the above"]);
      return;
    }
    const filtered = selectedConditions.filter((x) => x !== "None of the above");
    if (filtered.includes(item)) {
      setSelectedConditions(filtered.filter((x) => x !== item));
    } else {
      setSelectedConditions([...filtered, item]);
    }
  };

  const toggleAllergy = (item: string) => {
    if (item === "No Known Drug Allergies") {
      setSelectedAllergies(["No Known Drug Allergies"]);
      return;
    }
    const filtered = selectedAllergies.filter((x) => x !== "No Known Drug Allergies");
    if (filtered.includes(item)) {
      setSelectedAllergies(filtered.filter((x) => x !== item));
    } else {
      setSelectedAllergies([...filtered, item]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setTouched({ full_name: true, age: true });
      if (errors.full_name) {
        toast.error(errors.full_name);
        return;
      }
      if (errors.age) {
        toast.error("Please enter a valid age.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleFormatNotes = async () => {
    if (!form.notes.trim()) {
      toast.error("Please write a short doctor instruction first.");
      return;
    }
    setIsFormatting(true);
    setOriginalNotes(form.notes);
    try {
      await new Promise((r) => setTimeout(r, 350));
      let text = form.notes.trim();
      text = text.replace(/\bbp\b/gi, "blood pressure");
      text = text.replace(/\bgdm?\b/gi, "gestational diabetes (GDM)");
      text = text.replace(/\bhb\b/gi, "hemoglobin level");
      text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
      if (!/[.!?]$/.test(text)) text += ".";
      setForm((f) => ({ ...f, notes: `Doctor's instructions: ${text}` }));
      toast.success("Standardized clinical notation");
    } catch {
      toast.error("Unable to format notes.");
    } finally {
      setIsFormatting(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Session expired. Please log in again.");
      return;
    }
    setSaving(true);

    try {
      const conditionsStr = selectedConditions.length > 0 ? selectedConditions.join(", ") : null;
      const allergiesStr = selectedAllergies.length > 0 ? selectedAllergies.join(", ") : null;
      const emergencyContactStr = `${form.guardian_name.trim()} (${form.guardian_relationship}) • ${form.guardian_phone.trim()}`;

      // 1. Update public.users
      const { error: userError } = await supabase.from("users").upsert(
        {
          id: user.id,
          full_name: form.full_name.trim(),
          age: Number(form.age) || null,
          gestational_week: form.gestational_week,
          due_date: dueDateStr,
          doctor_name: form.doctor_name.trim() || null,
          hospital: form.hospital.trim() || null,
          emergency_contact: emergencyContactStr,
          conditions: conditionsStr,
          allergies: allergiesStr,
          dietary_preference: form.dietary_preference || null,
          notes: form.notes.trim() || null,
          onboarding_completed: true,
        },
        { onConflict: "id" }
      );

      if (userError) throw userError;

      // 2. Insert/update into emergency_contacts table
      if (form.guardian_name && form.guardian_phone) {
        await supabase.from("emergency_contacts").upsert(
          {
            user_id: user.id,
            name: form.guardian_name.trim(),
            relationship: form.guardian_relationship,
            phone: form.guardian_phone.trim(),
            is_primary: true,
          },
          { onConflict: "user_id, phone" }
        ).catch(() => {});
      }

      // 3. Initialize privacy_settings
      await supabase.from("privacy_settings").upsert(
        {
          user_id: user.id,
          share_with_doctor: true,
          location_enabled: true,
          ai_training: false,
        },
        { onConflict: "user_id" }
      ).catch(() => {});

      toast.success("Maternal profile set up successfully! Welcome to MomSafe.");
      if (onComplete) onComplete();
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-6 sm:py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-between items-center text-slate-800 antialiased font-sans">
      {/* Container Card */}
      <div className="max-w-6xl w-full bg-white rounded-3xl shadow-[0_20px_50px_-15px_rgba(1,60,44,0.08)] border border-slate-200/70 overflow-hidden flex flex-col my-auto transition-all">
        {/* Top Navbar: Clean, Spacious, Official Favicon Logo */}
        <header className="px-6 sm:px-10 py-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Official MomSafe Logo (Exact Favicon from /favicon.svg) */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/favicon.svg"
              alt="MomSafe AI"
              className="w-9 h-9 rounded-xl shadow-sm shrink-0"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                MomSafe
              </span>
              <span className="text-xl font-extrabold text-[#044735]">
                AI
              </span>
            </div>
          </div>

          {/* Stepper Breadcrumbs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                step === 1
                  ? "bg-emerald-50 text-[#044735] font-bold border-b-2 border-[#044735]"
                  : "hover:text-slate-900"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > 1 ? "bg-[#044735] text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 1 ? "✓" : "1"}
              </span>
              1. Personal & Care Team
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(2);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                step === 2
                  ? "bg-emerald-50 text-[#044735] font-bold border-b-2 border-[#044735]"
                  : "hover:text-slate-900"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > 2 ? "bg-[#044735] text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 2 ? "✓" : "2"}
              </span>
              2. Clinical Context
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(3);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                step === 3
                  ? "bg-emerald-50 text-[#044735] font-bold border-b-2 border-[#044735]"
                  : "hover:text-slate-900"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > 3 ? "bg-[#044735] text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {step > 3 ? "✓" : "3"}
              </span>
              3. Nutrition & Diet
            </button>
            <span className="text-slate-300">›</span>

            <button
              type="button"
              onClick={() => {
                if (!errors.full_name) setStep(4);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                step === 4
                  ? "bg-emerald-50 text-[#044735] font-bold border-b-2 border-[#044735]"
                  : "hover:text-slate-900"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 4 ? "bg-[#044735] text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                4
              </span>
              4. Care Activation
            </button>
          </nav>

          {/* User Session & Actions */}
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-slate-500 font-medium">
              Signed in as{" "}
              <strong className="text-slate-800 font-semibold">
                {user?.email || "pooja.sharma@gmail.com"}
              </strong>
            </span>
            <div className="hidden sm:block h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => setActiveModal("help")}
              className="flex items-center gap-1.5 text-slate-600 hover:text-[#044735] font-medium px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              Help
            </button>
            <button
              type="button"
              onClick={() => {
                toast.info("Draft progress saved.");
                window.location.href = "/dashboard";
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              Save & Exit
            </button>
          </div>
        </header>

        {/* Split Card Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* LEFT COLUMN: Clean Numbered Stepper Rail */}
          <aside className="lg:col-span-5 bg-[#FAFBFB] p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-between relative">
            <div>
              {/* Notice Banner */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3 mb-8">
                <Info className="w-4 h-4 text-[#044735] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                  Welcome to MomSafe AI. Set up your pregnancy baseline to calibrate 24/7 vitals telemetry, emergency loop, and gestational alerts.
                </p>
              </div>

              {/* Connected Vertical Timeline */}
              <div className="space-y-8 relative pl-1">
                {/* Connecting Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200 -z-0" />

                {/* Step 1 Node */}
                <div
                  onClick={() => setStep(1)}
                  className="flex items-start gap-4 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      step === 1
                        ? "bg-[#044735] text-white shadow-md ring-4 ring-emerald-100"
                        : step > 1
                        ? "bg-[#044735] text-white"
                        : "bg-white border border-slate-200 text-slate-400"
                    }`}
                  >
                    {step > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : "1"}
                  </div>
                  <div>
                    <span
                      className={`text-sm block transition-colors ${
                        step === 1 ? "text-slate-900 font-bold" : "text-slate-700 font-semibold"
                      }`}
                    >
                      Personal & Care Team
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Mother's name, gestational stage, OB/GYN doctor, and family guardian.
                    </p>
                  </div>
                </div>

                {/* Step 2 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(2);
                  }}
                  className="flex items-start gap-4 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      step === 2
                        ? "bg-[#044735] text-white shadow-md ring-4 ring-emerald-100"
                        : step > 2
                        ? "bg-[#044735] text-white"
                        : "bg-white border border-slate-200 text-slate-400"
                    }`}
                  >
                    {step > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : "2"}
                  </div>
                  <div>
                    <span
                      className={`text-sm block transition-colors ${
                        step === 2 ? "text-slate-900 font-bold" : "text-slate-700 font-semibold"
                      }`}
                    >
                      Clinical History & Risk
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Pre-existing conditions, allergies, and clinical physician instructions.
                    </p>
                  </div>
                </div>

                {/* Step 3 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(3);
                  }}
                  className="flex items-start gap-4 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      step === 3
                        ? "bg-[#044735] text-white shadow-md ring-4 ring-emerald-100"
                        : step > 3
                        ? "bg-[#044735] text-white"
                        : "bg-white border border-slate-200 text-slate-400"
                    }`}
                  >
                    {step > 3 ? <Check className="w-4 h-4 stroke-[3]" /> : "3"}
                  </div>
                  <div>
                    <span
                      className={`text-sm block transition-colors ${
                        step === 3 ? "text-slate-900 font-bold" : "text-slate-700 font-semibold"
                      }`}
                    >
                      Nutrition & Dietary Plan
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Low-glycemic millets, vegetarian options, and meal telemetry sync.
                    </p>
                  </div>
                </div>

                {/* Step 4 Node */}
                <div
                  onClick={() => {
                    if (!errors.full_name) setStep(4);
                  }}
                  className="flex items-start gap-4 cursor-pointer group relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      step === 4
                        ? "bg-[#044735] text-white shadow-md ring-4 ring-emerald-100"
                        : "bg-white border border-slate-200 text-slate-400"
                    }`}
                  >
                    4
                  </div>
                  <div>
                    <span
                      className={`text-sm block transition-colors ${
                        step === 4 ? "text-slate-900 font-bold" : "text-slate-700 font-semibold"
                      }`}
                    >
                      Care Plan Activation
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Review maternal baseline and connect 24/7 emergency guardian loop.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Reassurance Card */}
            <div className="mt-8 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-[#044735] shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs leading-tight">
                <p className="font-bold text-slate-900">
                  DPDP Act 2023 & ABDM Compliant
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  End-to-end encrypted health data stored on Indian servers.
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: Interactive Form Content */}
          <main className="lg:col-span-7 p-6 sm:p-10 bg-white flex flex-col justify-between">
            <div>
              {/* Step Header */}
              <div className="mb-6">
                <div className="text-xs font-bold uppercase tracking-wider text-[#044735] mb-1">
                  STEP {step} OF 4 —{" "}
                  {step === 1 && "Personal & Care Team"}
                  {step === 2 && "Clinical History & Risk"}
                  {step === 3 && "Nutrition & Dietary Preferences"}
                  {step === 4 && "Baseline Review & Activation"}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {step === 1 && "Tell us about your pregnancy journey"}
                  {step === 2 && "Clinical Conditions & Allergies"}
                  {step === 3 && "Dietary Preferences & Nutrition"}
                  {step === 4 && "Activate Your Maternal Care Plan"}
                </h1>
                <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                  {step === 1 &&
                    "Set your current pregnancy week. We automatically calculate your exact trimester and estimated due date for 24/7 vitals telemetry."}
                  {step === 2 &&
                    "Select any pre-existing conditions and allergies to calibrate predictive alerts and safe medications."}
                  {step === 3 &&
                    "Choose your daily nutrition preferences to personalize gestational meal logs and glucose targets."}
                  {step === 4 &&
                    "Confirm your clinical baseline to connect the 24/7 AI telemetry loop and emergency guardian escalation."}
                </p>
              </div>

              {/* Form Content By Step */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Mother's Legal Full Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                        Mother's Legal Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.full_name}
                          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                          onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
                          placeholder="e.g. Pooja Sharma"
                          className={`w-full h-11 px-3.5 pl-10 rounded-xl border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#044735] transition-all ${
                            touched.full_name && errors.full_name
                              ? "border-rose-300 bg-rose-50/20"
                              : "border-slate-200"
                          }`}
                        />
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                      {touched.full_name && errors.full_name && (
                        <p className="text-xs text-rose-500 mt-1">{errors.full_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                        Age (Years)
                      </label>
                      <input
                        type="number"
                        min="16"
                        max="55"
                        value={form.age}
                        onChange={(e) => setForm({ ...form, age: e.target.value })}
                        placeholder="28"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#044735] transition-all"
                      />
                    </div>
                  </div>

                  {/* Automatic Gestational Week & Trimester / Due Date Calculator */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Baby className="w-4 h-4 text-[#044735]" />
                        Current Pregnancy Week: <span className="text-[#044735] text-sm">Week {form.gestational_week}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, gestational_week: Math.max(1, f.gestational_week - 1) }))
                          }
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors shadow-sm"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, gestational_week: Math.min(42, f.gestational_week + 1) }))
                          }
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Slider */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="1"
                        max="40"
                        value={form.gestational_week}
                        onChange={(e) =>
                          setForm({ ...form, gestational_week: Number(e.target.value) })
                        }
                        className="w-full accent-[#044735] cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Week 1 (Conception)</span>
                        <span>Week 20 (Mid-term)</span>
                        <span>Week 40 (Full Term)</span>
                      </div>
                    </div>

                    {/* Automatic Live Calculation Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Stage</span>
                        <span className="font-bold text-slate-900 mt-0.5 block truncate">
                          {trimester}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Calculated Due Date</span>
                        <span className="font-bold text-[#044735] mt-0.5 block truncate">
                          {formattedDate}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery Window</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">
                          {daysRemaining} Days to Go
                        </span>
                      </div>
                    </div>

                    {/* Fetal Milestone Note */}
                    <p className="text-[11px] text-slate-600 bg-white/60 p-2 rounded-lg border border-slate-200/50 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#044735] shrink-0 mt-0.5" />
                      <span>{getWeekMilestone(form.gestational_week)}</span>
                    </p>
                  </div>

                  {/* Doctor & Hospital Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                        Consulting OB/GYN Doctor
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.doctor_name}
                          onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
                          placeholder="Dr. Priya Sharma, MD"
                          className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#044735] transition-all"
                        />
                        <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                        Hospital / Maternity Clinic
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.hospital}
                          onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                          placeholder="Cloudnine Hospital / Apollo Cradle"
                          className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#044735] transition-all"
                        />
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Emergency Guardian Contact */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Emergency Guardian / Partner Loop
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={form.guardian_name}
                          onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                          placeholder="Guardian Name"
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044735]"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.guardian_relationship}
                          onChange={(e) =>
                            setForm({ ...form, guardian_relationship: e.target.value })
                          }
                          placeholder="Relationship (e.g. Husband)"
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044735]"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.guardian_phone}
                          onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044735]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {/* Conditions */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      Pre-existing & Gestational Conditions
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INDIAN_CONDITIONS.map((item) => {
                        const active = selectedConditions.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleCondition(item)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-50 border border-[#044735] text-[#044735] font-bold shadow-sm"
                                : "bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                active ? "bg-[#044735] text-white" : "border border-slate-300"
                              }`}
                            >
                              {active ? "✓" : ""}
                            </span>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allergies */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      Known Drug & Food Allergies
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INDIAN_ALLERGIES.map((item) => {
                        const active = selectedAllergies.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleAllergy(item)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-emerald-50 border border-[#044735] text-[#044735] font-bold shadow-sm"
                                : "bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                                active ? "bg-[#044735] text-white" : "border border-slate-300"
                              }`}
                            >
                              {active ? "✓" : ""}
                            </span>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Physician Directive Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                        Doctor's Directives & Prescriptions
                      </label>
                      <button
                        type="button"
                        onClick={handleFormatNotes}
                        disabled={isFormatting}
                        className="text-[11px] font-semibold text-[#044735] hover:underline flex items-center gap-1"
                      >
                        {isFormatting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        Format Note
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="e.g. Regular BP checks twice daily. Alert team if BP exceeds 135/85 mmHg or if fasting sugar crosses 95 mg/dL."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#044735] transition-all"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INDIAN_DIETS.map((diet) => {
                      const selected = form.dietary_preference === diet.id;
                      return (
                        <div
                          key={diet.id}
                          onClick={() => setForm({ ...form, dietary_preference: diet.id })}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            selected
                              ? "border-[#044735] bg-emerald-50/40 shadow-sm"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-sm font-bold ${
                                  selected ? "text-slate-900" : "text-slate-800"
                                }`}
                              >
                                {diet.title}
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                                  selected
                                    ? "bg-[#044735] border-[#044735] text-white"
                                    : "border-slate-300"
                                }`}
                              >
                                {selected && "✓"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mt-1">
                              {diet.desc}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#044735] mt-3">
                            {diet.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Telemetry Toggle */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between mt-4">
                    <div className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          Continuous Glucose & Meal Sync
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Correlate meal timings and daily hydration with continuous vitals tracking.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={form.enable_telemetry}
                        onChange={(e) =>
                          setForm({ ...form, enable_telemetry: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#044735]"></div>
                    </label>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Maternal Care Baseline
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {form.full_name || "Pooja Sharma"} • {trimester} (Week {form.gestational_week})
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#044735] text-xs font-bold border border-emerald-200">
                        Ready to Initialize
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[11px] block">Calculated Due Date</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">
                          {formattedDate} ({daysRemaining} days remaining)
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[11px] block">Doctor & Hospital</span>
                        <span className="font-bold text-slate-800 mt-0.5 block truncate">
                          {form.doctor_name} • {form.hospital}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                        Activated Clinical Loops:
                      </span>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          24/7 AI Maternal Vitals Telemetry
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">Calibrated</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Emergency SOS & {form.guardian_name} ({form.guardian_phone})
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">SMS Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentation Pills Row */}
              <div className="mt-8 pt-5 border-t border-slate-100">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal("dpdp")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#044735]" />
                    DPDP Act 2023 & ABDM Privacy
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("fogsi")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#044735]" />
                    FOGSI & ICMR Guidelines
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal("emergency108")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    National 108 Emergency Loop
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400 order-2 sm:order-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Autosaved {lastSavedTime}
                </span>
                {step > 1 && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="text-slate-600 hover:text-slate-900 font-medium underline flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back to Step {step - 1}
                    </button>
                  </>
                )}
              </div>

              <div className="order-1 sm:order-2 w-full sm:w-auto flex items-center gap-3">
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#044735] hover:bg-[#013c2c] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Save and continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#044735] hover:bg-[#013c2c] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Activating Care Baseline...
                      </>
                    ) : (
                      <>
                        <span>Complete Care Setup</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl w-full mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 px-4">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-extrabold text-slate-800">MomSafe AI</span>
          <span>•</span>
          <p>© 2026 MomSafe Technologies. Clinical data protected under India DPDP Act 2023.</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveModal("dpdp")}
            className="hover:text-slate-800 underline transition-colors"
          >
            Data Privacy
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("fogsi")}
            className="hover:text-slate-800 underline transition-colors"
          >
            FOGSI Guidelines
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("emergency108")}
            className="hover:text-slate-800 underline transition-colors"
          >
            Emergency 108 Loop
          </button>
        </div>
      </footer>

      {/* Info Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            {activeModal === "dpdp" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#044735] flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Digital Personal Data Protection (DPDP) Act 2023 & ABDM
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  MomSafe AI adheres strictly to India's DPDP Act 2023 and Ayushman Bharat Digital Mission (ABDM) standards. All electronic health records and vitals are encrypted with AES-256 and hosted on secure Indian cloud infrastructure. Data is never shared with third-party advertisers.
                </p>
              </div>
            )}

            {activeModal === "fogsi" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#044735] flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  FOGSI & ICMR Clinical Guidelines
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Our clinical triage alerts follow clinical recommendations formulated by the Federation of Obstetric and Gynaecological Societies of India (FOGSI) and the Indian Council of Medical Research (ICMR). Thresholds for gestational hypertension (&gt;140/90 mmHg), anemia (Hb &lt;11 g/dL), and gestational diabetes are calibrated to Indian maternal cohorts.
                </p>
              </div>
            )}

            {activeModal === "emergency108" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  National 108 Emergency Ambulance & Guardian SOS Loop
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  During an acute maternal crisis (e.g., eclampsia warning, critical BP spike, or absent fetal movements), MomSafe AI triggers an automated emergency loop. It transmits real-time high-priority SMS notifications with GPS coordinates to your registered family guardian and provides one-touch integration with local 108 Emergency Medical Services.
                </p>
              </div>
            )}

            {activeModal === "help" && (
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#044735] flex items-center justify-center mb-3">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  MomSafe Care Assistance
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Have questions about your intake setup or sensor pairing? Our maternal care team is available to assist you.
                </p>
                <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <p className="font-bold text-slate-800">Support Availability: 24/7 Priority Emergency Care</p>
                  <p className="text-slate-600 mt-1">Helpline: 1800-MOMSAFE (Toll-Free, India)</p>
                  <p className="text-slate-500 mt-0.5">Email: care@momsafe.health</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#044735] text-white text-xs font-semibold hover:bg-[#013c2c] transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
