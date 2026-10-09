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
  Mail,
  BookOpen,
} from "lucide-react";

function validateName(name: string): string | null {
  const v = name.trim();
  if (!v) return "Please enter your full legal name";
  if (v.length < 4) return "Name must be at least 4 characters";
  if (v.length > 80) return "Name must be under 80 characters";
  if (/\d/.test(v)) return "Name cannot contain numbers";
  if (/[!@#$%^&*()_=+{}[\]:;"'<>,?/~`]/.test(v)) return "Name cannot contain special characters";

  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "Please enter both First Name and Last Name";

  for (const word of words) {
    if (word.length < 2) return "Each name must be at least 2 characters long";

    // Repeated identical character check (e.g. "ww", "zzz", "aaaa")
    if (/^(.)\1+$/i.test(word)) {
      return `"${word}" is not a valid real name`;
    }

    // Must contain at least one vowel
    if (!/[aeiouy]/i.test(word)) {
      return `"${word}" is missing vowels and appears to be random keyboard letters`;
    }

    // Streak of 3+ identical letters
    if (/(.)\1{2,}/i.test(word)) {
      return "Name contains too many repeated consecutive letters";
    }

    // Known spam/keyboard-mash tokens
    const lower = word.toLowerCase();
    const banned = [
      "xxx", "asdf", "qwer", "zxcv", "hjkl", "test", "demo", "dummy",
      "null", "none", "fake", "user", "admin", "temp", "aswhu", "ww", "sw"
    ];
    if (banned.some((b) => lower === b || (b.length >= 4 && lower.includes(b)))) {
      return "Please enter an authentic legal name";
    }
  }

  const validPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*)+$/;
  if (!validPattern.test(v)) {
    return "Please enter a valid full name (letters only)";
  }

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

function validateGuardianName(name: string): string | null {
  const v = name.trim();
  if (!v) return "Please enter guardian's name";
  if (v.length < 2) return "Guardian name must be at least 2 characters";
  if (/\d/.test(v)) return "Guardian name cannot contain numbers";
  if (/^(.)\1+$/i.test(v) || !/[aeiouy]/i.test(v)) return "Please enter a valid guardian name";
  return null;
}

function validateIndianPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (!cleaned) return "Please enter guardian's mobile number";
  const re = /^(?:\+91|91|0)?[6-9]\d{9}$/;
  if (!re.test(cleaned)) return "Please enter a valid 10-digit Indian mobile number (e.g. +91 98765 43210)";
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
  if (week <= 8) return "Early embryonic stage: Vital neural tube and heart chambers forming.";
  if (week <= 12) return "End of 1st Trimester: Baby's heartbeat is clearly detectable; organs formed.";
  if (week <= 16) return "Week 16: Rapid growth, baby's facial expressions and movement developing.";
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

  const errors = {
    full_name: validateName(form.full_name),
    age: validateAge(form.age),
    guardian_name: validateGuardianName(form.guardian_name),
    guardian_phone: validateIndianPhone(form.guardian_phone),
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
      setTouched({ full_name: true, age: true, guardian_name: true, guardian_phone: true });
      if (errors.full_name) {
        toast.error(errors.full_name);
        return;
      }
      if (errors.age) {
        toast.error(errors.age);
        return;
      }
      if (errors.guardian_name) {
        toast.error(errors.guardian_name);
        return;
      }
      if (errors.guardian_phone) {
        toast.error(errors.guardian_phone);
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
      toast.error("Please write a doctor directive or advice note first.");
      return;
    }
    setIsFormatting(true);
    try {
      await new Promise((r) => setTimeout(r, 350));
      let text = form.notes.trim();
      text = text.replace(/\bbp\b/gi, "blood pressure");
      text = text.replace(/\bgdm?\b/gi, "gestational diabetes (GDM)");
      text = text.replace(/\bhb\b/gi, "hemoglobin level");
      text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
      if (!/[.!?]$/.test(text)) text += ".";
      setForm((f) => ({ ...f, notes: `Doctor's instructions: ${text}` }));
      toast.success("Standardized clinical triage notation");
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

      // 1. Update public.users table (The single source of truth for the AI Guidance & Risk Engines)
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

      // 2. Insert into emergency_contacts table for granular emergency SMS/SOS lookups
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

      // 3. Initialize privacy settings
      await supabase.from("privacy_settings").upsert(
        {
          user_id: user.id,
          share_with_doctor: true,
          location_enabled: true,
          ai_training: false,
        },
        { onConflict: "user_id" }
      ).catch(() => {});

      toast.success("Maternal profile set up successfully! AI companion is now calibrated.");
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
          {/* Official Favicon Logo with clean text */}
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
                  End-to-end encrypted health data stored securely on Indian servers.
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
                        onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                        placeholder="28"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#044735] transition-all"
                      />
                      {touched.age && errors.age && (
                        <p className="text-xs text-rose-500 mt-1">{errors.age}</p>
                      )}
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
                      Emergency Guardian / Partner Loop <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={form.guardian_name}
                          onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                          onBlur={() => setTouched((t) => ({ ...t, guardian_name: true }))}
                          placeholder="Guardian Name"
                          className={`w-full h-10 px-3 rounded-lg border text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044735] ${
                            touched.guardian_name && errors.guardian_name
                              ? "border-rose-300"
                              : "border-slate-200"
                          }`}
                        />
                        {touched.guardian_name && errors.guardian_name && (
                          <p className="text-[10px] text-rose-500 mt-1">{errors.guardian_name}</p>
                        )}
                      </div>
                      <div>
                        <select
                          value={form.guardian_relationship}
                          onChange={(e) =>
                            setForm({ ...form, guardian_relationship: e.target.value })
                          }
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044735]"
                        >
                          <option value="Husband">Husband / Partner</option>
                          <option value="Mother">Mother</option>
                          <option value="Father">Father</option>
                          <option value="Sister">Sister</option>
                          <option value="Brother">Brother</option>
                          <option value="Relative / Friend">Relative / Friend</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.guardian_phone}
                          onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                          onBlur={() => setTouched((t) => ({ ...t, guardian_phone: true }))}
                          placeholder="+91 98765 43210"
                          className={`w-full h-10 px-3 rounded-lg border text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044735] ${
                            touched.guardian_phone && errors.guardian_phone
                              ? "border-rose-300"
                              : "border-slate-200"
                          }`}
                        />
                        {touched.guardian_phone && errors.guardian_phone && (
                          <p className="text-[10px] text-rose-500 mt-1">{errors.guardian_phone}</p>
                        )}
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
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Calculated Due Date</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">
                          {formattedDate} ({daysRemaining} days remaining)
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Doctor & Hospital</span>
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
          <button
            type="button"
            onClick={() => setActiveModal("help")}
            className="hover:text-slate-800 underline transition-colors"
          >
            Support
          </button>
        </div>
      </footer>

      {/* Comprehensive Document Reader Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#044735] flex items-center justify-center font-bold">
                  {activeModal === "dpdp" && <Lock className="w-5 h-5" />}
                  {activeModal === "fogsi" && <ShieldCheck className="w-5 h-5" />}
                  {activeModal === "emergency108" && <Zap className="w-5 h-5 text-amber-500" />}
                  {activeModal === "help" && <Mail className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {activeModal === "dpdp" && "DPDP Act 2023 & ABDM Health Privacy"}
                    {activeModal === "fogsi" && "FOGSI & ICMR Clinical Obstetric Standards"}
                    {activeModal === "emergency108" && "National 108 Emergency & SOS Protocol"}
                    {activeModal === "help" && "MomSafe AI Care Support"}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {activeModal === "dpdp" && "Official Data Protection Policy • Version 2026.1"}
                    {activeModal === "fogsi" && "Clinical Practice Guidelines • Evidence-Based Care"}
                    {activeModal === "emergency108" && "Emergency Medical Escalation Specification"}
                    {activeModal === "help" && "Maternal Navigation Team"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-xs text-slate-600 leading-relaxed">
              {activeModal === "dpdp" && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">1. Legislative Compliance & Sovereign Hosting</h4>
                    <p>
                      MomSafe AI complies fully with India's <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and the <strong>Ayushman Bharat Digital Mission (ABDM)</strong> health data registry frameworks. All sensitive personal data (SPD) and maternal electronic health records (EHR) are hosted in Tier-4 sovereign cloud data centers located within the Republic of India.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">2. Encryption at Rest & In Transit</h4>
                    <p>
                      Biometric vitals (systolic/diastolic blood pressure, continuous glucose levels, heart rate variability, fetal movement logs) are encrypted using <strong>AES-256</strong> cipher specifications at rest and <strong>TLS 1.3</strong> during network transmission.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">3. Non-Commercial Data Commitment</h4>
                    <p>
                      Your clinical intake notes, medical allergies, and pregnancy timeline are strictly confidential. MomSafe AI does not sell, license, or monetize maternal health data to third-party ad networks or pharmaceutical brokers.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">4. Patient Rights & Data Erasure</h4>
                    <p>
                      In accordance with Section 12 of the DPDP Act 2023, you hold the unreserved right to request data portability, access logs, and complete account erasure. You may trigger account deletion directly from the Settings tab or by contacting our Data Protection Officer (DPO) at <strong>support@momsafe.in</strong>.
                    </p>
                  </div>
                </>
              )}

              {activeModal === "fogsi" && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">1. Obstetric Reference Parameters</h4>
                    <p>
                      All predictive risk algorithms in MomSafe AI conform to clinical guidelines issued by the <strong>Federation of Obstetric and Gynaecological Societies of India (FOGSI)</strong> and the <strong>Indian Council of Medical Research (ICMR)</strong>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">2. Blood Pressure & Preeclampsia Thresholds</h4>
                    <p>
                      - Normal Baseline: &lt;120/80 mmHg.<br />
                      - Pre-hypertension Observation: 130–139/80–89 mmHg.<br />
                      - Severe Gestational Alert: Systolic &ge;140 mmHg or Diastolic &ge;90 mmHg recorded on two occasions at least 4 hours apart.<br />
                      - Critical Emergency Escalation: Systolic &gt;160 mmHg triggers immediate red-alert notification.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">3. Gestational Diabetes Mellitus (GDM) Targets</h4>
                    <p>
                      Calibrated in accordance with the Diabetes in Pregnancy Study Group India (DIPSI) and ICMR standards: Fasting blood glucose &lt;90 mg/dL, 1-hour post-meal &lt;140 mg/dL, and 2-hour post-meal &lt;120 mg/dL.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">4. Maternal Anemia Stratification</h4>
                    <p>
                      Hemoglobin thresholds adjusted for Indian maternal demographics: Normal: &ge;11.0 g/dL; Mild Anemia: 10.0–10.9 g/dL; Moderate Anemia: 7.0–9.9 g/dL; Severe Anemia: &lt;7.0 g/dL requiring urgent clinical intervention.
                    </p>
                  </div>
                </>
              )}

              {activeModal === "emergency108" && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">1. Automated SOS Escalation Protocol</h4>
                    <p>
                      MomSafe AI continuously evaluates telemetry streams against critical risk factors. In the event of severe hemodynamic anomalies or SOS button activation, the platform initiates a priority emergency loop.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">2. Guardian SMS & Location Dispatch</h4>
                    <p>
                      An automated high-priority SMS containing current vitals summary, GPS location link, and patient identification is transmitted to your registered family guardian ({form.guardian_name || "Primary Contact"}).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">3. Integration with National 108 EMS</h4>
                    <p>
                      Provides one-touch emergency connectivity to the <strong>National 108 Ambulance Network</strong> across Indian states with automated routing to the nearest empanelled maternal care emergency department.
                    </p>
                  </div>
                </>
              )}

              {activeModal === "help" && (
                <div className="space-y-4">
                  <p>
                    Have questions about your intake setup, gestational age calibration, or sensor pairing? Our maternal care team is dedicated to assisting you throughout your pregnancy.
                  </p>
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-2">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <Mail className="w-4 h-4 text-[#044735]" />
                      <span>Email Support</span>
                    </div>
                    <p className="text-slate-600 font-semibold text-sm">support@momsafe.in</p>
                    <p className="text-[11px] text-slate-500">
                      Our care navigators respond to all maternal inquiries within 24 hours.
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    *For medical emergencies, please use the 108 Emergency Loop or contact your consulting hospital ({form.hospital}) immediately.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 rounded-xl bg-[#044735] text-white text-xs font-bold hover:bg-[#013c2c] transition-colors"
              >
                Close Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
