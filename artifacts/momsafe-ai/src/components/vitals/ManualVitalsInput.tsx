import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Activity, Plus, Heart, Droplets, Thermometer, Scale, ChevronLeft, ChevronRight, Check, AlertCircle, Info, RefreshCcw, Minus, Wifi } from "lucide-react";
import { createAlert, checkVitalsForAlerts } from "@/lib/alerts";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ManualVitalsInputProps {
  onSuccess?: () => void;
}

type Step = "selection" | "input" | "confirmation" | "success";
type VitalType = "heart_rate" | "blood_pressure" | "spo2" | "temperature" | "weight";

interface VitalMetadata {
  id: VitalType;
  label: string;
  icon: any;
  unit: string;
  min: number;
  max: number;
  step: number;
  normalMin: number;
  normalMax: number;
  description: string;
  color: string;
}

interface Esp32Reading {
  recorded_at: string;
  temperature: number | null;
  steps: number | null;
  source: string;
}

const isMissingColumnError = (error: any, column: string) =>
  error?.code === "PGRST204" &&
  typeof error?.message === "string" &&
  error.message.includes(`'${column}'`) &&
  error.message.includes("'vitals'");

const vitalsMetadata: VitalMetadata[] = [
  { id: "heart_rate", label: "Heart Rate", icon: Heart, unit: "bpm", min: 40, max: 180, step: 1, normalMin: 60, normalMax: 100, description: "Your heart rate reflects how hard your body is working.", color: "text-red-500" },
  { id: "blood_pressure", label: "Blood Pressure", icon: Activity, unit: "mmHg", min: 70, max: 200, step: 1, normalMin: 90, normalMax: 120, description: "Monitoring BP is crucial for detecting signs of preeclampsia.", color: "text-purple-500" },
  { id: "spo2", label: "SpO2", icon: Droplets, unit: "%", min: 80, max: 100, step: 1, normalMin: 95, normalMax: 100, description: "Oxygen saturation measures your lung's effectiveness.", color: "text-emerald-500" },
  { id: "temperature", label: "Temperature", icon: Thermometer, unit: "°C", min: 34, max: 42, step: 0.1, normalMin: 36.1, normalMax: 37.2, description: "Temperature tracks your overall physiological stability.", color: "text-amber-500" },
  { id: "weight", label: "Weight", icon: Scale, unit: "kg", min: 30, max: 200, step: 0.1, normalMin: 45, normalMax: 150, description: "Weight tracking helps monitor healthy pregnancy progression.", color: "text-blue-500" },
];

export function ManualVitalsInput({ onSuccess }: ManualVitalsInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("selection");
  const [selectedVital, setSelectedVital] = useState<VitalType | null>(null);
  const [lastVitals, setLastVitals] = useState<any>(null);
  const [esp32LastReading, setEsp32LastReading] = useState<Esp32Reading | null>(null);
  const [esp32Loading, setEsp32Loading] = useState(false);

  const [formData, setFormData] = useState({
    heart_rate: "",
    systolic_bp: "",
    diastolic_bp: "",
    spo2: "",
    temperature: "",
    weight: "",
  });

  // Fetch last vitals for reference
  useEffect(() => {
    if (user && open) {
      const fetchLastVitals = async () => {
        setEsp32Loading(true);
        const { data, error } = await supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!error && data) {
          setLastVitals(data);
          // Set initial values from last vitals for easier editing
          setFormData({
            heart_rate: String(data.heart_rate || ""),
            systolic_bp: String(data.systolic_bp || ""),
            diastolic_bp: String(data.diastolic_bp || ""),
            spo2: String(data.spo2 || ""),
            temperature: String(data.temperature || ""),
            weight: String(data.weight || ""),
          });
        }

        const { data: esp32Data, error: esp32Error } = await supabase
          .from("vitals")
          .select("recorded_at, temperature, steps, source")
          .eq("user_id", user.id)
          .eq("source", "esp32")
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (esp32Error && (isMissingColumnError(esp32Error, "source") || isMissingColumnError(esp32Error, "steps"))) {
          // Backward compatibility: older schemas may not yet include ESP32 columns.
          setEsp32LastReading(null);
        } else {
          setEsp32LastReading(esp32Data || null);
        }
        setEsp32Loading(false);
      };
      fetchLastVitals();
    }
  }, [user, open]);

  const handleReset = () => {
    setStep("selection");
    setSelectedVital(null);
    setFormData({
      heart_rate: lastVitals?.heart_rate ? String(lastVitals.heart_rate) : "",
      systolic_bp: lastVitals?.systolic_bp ? String(lastVitals.systolic_bp) : "",
      diastolic_bp: lastVitals?.diastolic_bp ? String(lastVitals.diastolic_bp) : "",
      spo2: lastVitals?.spo2 ? String(lastVitals.spo2) : "",
      temperature: lastVitals?.temperature ? String(lastVitals.temperature) : "",
      weight: lastVitals?.weight ? String(lastVitals.weight) : "",
    });
  };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getStatus = (type: VitalType, value: number) => {
    const meta = vitalsMetadata.find(m => m.id === type);
    if (!meta) return { label: "Unknown", color: "text-gray-400", bg: "bg-gray-100" };

    if (type === "blood_pressure") {
      // For BP, we check systolic here, but in UI we might need both.
      // Let's assume we pass systolic for this check
      if (value >= 140) return { label: "High Risk", color: "text-red-600", bg: "bg-red-50", message: "Blood pressure is high. Needs attention." };
      if (value >= 130) return { label: "Slightly elevated", color: "text-amber-600", bg: "bg-amber-50", message: "Slightly above normal." };
      if (value >= 90 && value <= 120) return { label: "Normal", color: "text-emerald-600", bg: "bg-emerald-50", message: "Within safe range." };
      return { label: "Low", color: "text-blue-600", bg: "bg-blue-50", message: "Below normal range." };
    }

    if (value > meta.normalMax) return { label: "Elevated", color: "text-red-600", bg: "bg-red-50", message: "Slightly above normal." };
    if (value < meta.normalMin) return { label: "Low", color: "text-blue-600", bg: "bg-blue-50", message: "Below normal range." };
    return { label: "Normal", color: "text-emerald-600", bg: "bg-emerald-50", message: "Within safe range." };
  };

  const currentStatus = useMemo(() => {
    if (!selectedVital) return null;
    let val = 0;
    if (selectedVital === "blood_pressure") val = Number(formData.systolic_bp);
    else val = Number(formData[selectedVital as keyof typeof formData]);
    
    return getStatus(selectedVital, val);
  }, [selectedVital, formData]);

  const validate = (showToast = false) => {
    if (!selectedVital) return false;

    if (selectedVital === "blood_pressure") {
      const sys = Number(formData.systolic_bp);
      const dia = Number(formData.diastolic_bp);
      if (!formData.systolic_bp || !formData.diastolic_bp) return false;
      if (sys < 70 || sys > 250 || dia < 40 || dia > 150) {
        if (showToast) {
          toast({ title: "Validation Error", description: "Please enter reasonable BP values.", variant: "destructive" });
        }
        return false;
      }
    } else {
      const val = Number(formData[selectedVital as keyof typeof formData]);
      const meta = vitalsMetadata.find(m => m.id === selectedVital);
      if (!formData[selectedVital as keyof typeof formData]) return false;
      if (val < (meta?.min || 0) || val > (meta?.max || 1000)) {
        if (showToast) {
          toast({ title: "Validation Error", description: `Please enter a reasonable ${meta?.label}.`, variant: "destructive" });
        }
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validate(true)) return;

    setLoading(true);
    try {
      const payload: any = { user_id: user.id };
      
      // We only insert the fields we are actually logging in this session
      // to avoid overwriting other values with old data if we don't want to.
      // But the schema might require all. Let's send what we have.
      if (selectedVital === "blood_pressure") {
        payload.systolic_bp = Number(formData.systolic_bp);
        payload.diastolic_bp = Number(formData.diastolic_bp);
      } else {
        payload[selectedVital!] = Number(formData[selectedVital! as keyof typeof formData]);
      }

      // To maintain backend logic, we might need to send all fields.
      // Let's use current values from formData (which were pre-filled with last recorded if available)
      const fullPayload = {
        user_id: user.id,
        source: "manual",
        heart_rate: Number(formData.heart_rate) || lastVitals?.heart_rate || null,
        systolic_bp: Number(formData.systolic_bp) || lastVitals?.systolic_bp || null,
        diastolic_bp: Number(formData.diastolic_bp) || lastVitals?.diastolic_bp || null,
        spo2: Number(formData.spo2) || lastVitals?.spo2 || null,
        temperature: Number(formData.temperature) || lastVitals?.temperature || null,
        weight: Number(formData.weight) || lastVitals?.weight || null,
      };

      let { error } = await supabase.from("vitals").insert([fullPayload]);

      if (error && isMissingColumnError(error, "source")) {
        // Retry for environments where migration adding "source" is not applied yet.
        const legacyPayload = {
          user_id: fullPayload.user_id,
          heart_rate: fullPayload.heart_rate,
          systolic_bp: fullPayload.systolic_bp,
          diastolic_bp: fullPayload.diastolic_bp,
          spo2: fullPayload.spo2,
          temperature: fullPayload.temperature,
          weight: fullPayload.weight,
        };
        const retry = await supabase.from("vitals").insert([legacyPayload]);
        error = retry.error;
      }

      if (error) throw error;

      const anomalies = checkVitalsForAlerts(fullPayload);
      if (anomalies.length > 0) {
        for (const anomaly of anomalies) {
          await createAlert({ ...anomaly, user_id: user.id });
        }
      }

      setStep("success");
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({ title: "Error", description: error.message || "Failed to save vitals.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderSelection = () => (
    <div className="space-y-3 py-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">ESP32 Sync</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${esp32LastReading ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {esp32LastReading ? "Connected" : "Waiting"}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-blue-800/80 font-medium">
          {esp32Loading
            ? "Checking latest sensor upload..."
            : esp32LastReading
              ? `Last auto reading: ${new Date(esp32LastReading.recorded_at).toLocaleString()} (${esp32LastReading.temperature ?? "-"}°C, ${esp32LastReading.steps ?? 0} steps)`
              : "No ESP32 readings yet. Manual entry remains available below."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
      {vitalsMetadata.map((meta) => (
        <motion.button
          key={meta.id}
          whileHover={{ scale: 1.02, backgroundColor: "rgba(243, 244, 246, 0.8)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setSelectedVital(meta.id);
            setStep("input");
          }}
          className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-3xl shadow-sm transition-all hover:border-blue-100 group"
        >
          <div className={cn("p-3 rounded-2xl bg-gray-50 mb-3 group-hover:bg-white transition-colors", meta.color)}>
            <meta.icon className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-gray-700">{meta.label}</span>
          <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">{meta.unit}</span>
        </motion.button>
      ))}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          // Quick re-log of last session
          if (lastVitals) {
            setStep("confirmation");
          } else {
            toast({ title: "No history", description: "No previous records found to re-log." });
          }
        }}
        className="col-span-2 flex items-center justify-center gap-3 p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl mt-2 group"
      >
        <RefreshCcw className="w-4 h-4 text-blue-500 group-hover:rotate-180 transition-transform duration-500" />
        <span className="text-xs font-bold text-blue-600">Quick re-log last values</span>
      </motion.button>
      </div>
    </div>
  );

  const renderInput = () => {
    const meta = vitalsMetadata.find(m => m.id === selectedVital);
    if (!meta) return null;

    const isBP = selectedVital === "blood_pressure";
    const val = isBP ? Number(formData.systolic_bp) : Number(formData[selectedVital as keyof typeof formData]);
    const lastVal = isBP ? lastVitals?.systolic_bp : lastVitals?.[selectedVital!];

    return (
      <div className="space-y-6 py-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-2xl bg-gray-50", meta.color)}>
              <meta.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">{meta.label}</h3>
              <p className="text-[10px] text-gray-400 font-medium">Step 2 of 3: Enter Reading</p>
            </div>
          </div>
          <AnimatePresence mode="wait">
            {currentStatus && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm", currentStatus.color, currentStatus.bg, currentStatus.color.replace('text', 'border'))}
              >
                {currentStatus.label}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4 px-2">
          <div className="relative">
            {isBP ? (
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold ml-1">Systolic</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-gray-50" onClick={() => handleChange("systolic_bp", String(Number(formData.systolic_bp) - 1))}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      value={formData.systolic_bp}
                      onChange={(e) => handleChange("systolic_bp", e.target.value)}
                      className="text-center text-2xl font-black h-14 rounded-2xl border-2 focus-visible:ring-blue-500 transition-all"
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-gray-50" onClick={() => handleChange("systolic_bp", String(Number(formData.systolic_bp) + 1))}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-2xl font-black text-gray-300 pt-6">/</div>
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold ml-1">Diastolic</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-gray-50" onClick={() => handleChange("diastolic_bp", String(Number(formData.diastolic_bp) - 1))}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      value={formData.diastolic_bp}
                      onChange={(e) => handleChange("diastolic_bp", e.target.value)}
                      className="text-center text-2xl font-black h-14 rounded-2xl border-2 focus-visible:ring-blue-500 transition-all"
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-gray-50" onClick={() => handleChange("diastolic_bp", String(Number(formData.diastolic_bp) + 1))}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-gray-50" onClick={() => handleChange(selectedVital!, String(Number(formData[selectedVital! as keyof typeof formData]) - meta.step))}>
                    <Minus className="w-5 h-5" />
                  </Button>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      step={meta.step}
                      value={formData[selectedVital! as keyof typeof formData]}
                      onChange={(e) => handleChange(selectedVital!, e.target.value)}
                      className="text-center text-4xl font-black h-20 rounded-3xl border-2 focus-visible:ring-blue-500 transition-all"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-300">{meta.unit}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-gray-50" onClick={() => handleChange(selectedVital!, String(Number(formData[selectedVital! as keyof typeof formData]) + meta.step))}>
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="px-4 py-2">
                  <Slider
                    value={[val || meta.normalMin]}
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    onValueChange={(v) => handleChange(selectedVital!, String(v[0]))}
                    className="py-4"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Range Indicator */}
          <div className="space-y-2 pt-2">
            <div className="relative h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-400/30" style={{ width: `${((meta.normalMin - meta.min) / (meta.max - meta.min)) * 100}%` }} />
              <div className="h-full bg-emerald-500/30" style={{ width: `${((meta.normalMax - meta.normalMin) / (meta.max - meta.min)) * 100}%` }} />
              <div className="h-full bg-red-400/30" style={{ width: `${((meta.max - meta.normalMax) / (meta.max - meta.min)) * 100}%` }} />
              
              {/* Value Indicator Dot on Bar */}
              {!isBP && (
                <motion.div 
                  className={cn("absolute top-0 bottom-0 w-1 bg-white shadow-sm ring-2 ring-offset-1 z-10", currentStatus?.color.replace('text', 'ring'))}
                  animate={{ left: `${Math.min(100, Math.max(0, ((val - meta.min) / (meta.max - meta.min)) * 100))}%` }}
                  transition={{ type: "spring", damping: 15 }}
                />
              )}
            </div>
            <div className="flex justify-between text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">
              <span>Low</span>
              <span>Normal Zone</span>
              <span>High</span>
            </div>
          </div>

          {/* Smart Context & Reaction */}
          <div className="bg-gray-50/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className={cn("p-1.5 rounded-lg bg-white shadow-sm mt-0.5", currentStatus?.color)}>
                {currentStatus?.label === "Normal" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">{currentStatus?.message}</p>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  Normal range: {meta.normalMin}–{meta.normalMax} {meta.unit}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                <Info className="w-3 h-3" />
                <span>Normal for your current week</span>
              </div>
              {lastVal && (
                <div className="text-[10px] font-bold text-blue-500/70 bg-blue-50 px-2 py-0.5 rounded-md">
                  Last: {lastVal} {meta.unit}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmation = () => {
    const activeVitals = vitalsMetadata.filter(m => {
      if (m.id === "blood_pressure") return formData.systolic_bp && formData.diastolic_bp;
      return formData[m.id as keyof typeof formData];
    });

    return (
      <div className="space-y-6 py-4">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-3xl bg-blue-50 text-blue-600 mb-2">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-gray-900">Does this look correct?</h3>
          <p className="text-sm text-gray-500 font-medium">Please review your readings before saving.</p>
        </div>

        <div className="space-y-3">
          {activeVitals.map(meta => {
            const isBP = meta.id === "blood_pressure";
            const val = isBP ? `${formData.systolic_bp}/${formData.diastolic_bp}` : formData[meta.id as keyof typeof formData];
            const status = getStatus(meta.id, Number(isBP ? formData.systolic_bp : val));
            
            return (
              <div key={meta.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-white shadow-sm", meta.color)}>
                    <meta.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{meta.label}</p>
                    <p className={cn("text-[9px] font-black uppercase tracking-tighter", status.color)}>{status.label}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-gray-900 tabular-nums">{val}</p>
                  <p className="text-[10px] font-bold text-gray-400">{meta.unit}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    const meta = selectedVital ? vitalsMetadata.find(m => m.id === selectedVital) : null;
    const isBP = selectedVital === "blood_pressure";
    const val = isBP ? Number(formData.systolic_bp) : Number(formData[selectedVital as keyof typeof formData]);
    const status = selectedVital ? getStatus(selectedVital, val) : null;

    return (
      <div className="space-y-6 py-8 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="inline-flex p-5 rounded-full bg-emerald-50 text-emerald-500 mb-2"
        >
          <Check className="w-10 h-10" />
        </motion.div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-black text-gray-900">Vitals logged successfully</h3>
          <p className="text-sm text-gray-500 font-medium max-w-[240px] mx-auto">
            {selectedVital ? `Your ${meta?.label.toLowerCase()} is ${status?.label.toLowerCase()}.` : "Your vitals have been updated."}
          </p>
        </div>

        <div className="pt-4 space-y-3">
          <Button
            onClick={() => {
              handleReset();
              setStep("selection");
            }}
            className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-100"
          >
            Log another vital?
          </Button>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="w-full text-gray-500 font-bold hover:bg-gray-50"
          >
            I'm done for now
          </Button>
        </div>
      </div>
    );
  };

  const canContinue = useMemo(() => validate(false), [selectedVital, formData]);

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        // Reset on close
        setTimeout(handleReset, 300);
      }
      setOpen(val);
    }}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-100 transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          Add Vitals
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] rounded-3xl border-none p-0 overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl">
        <div className="p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-black text-gray-900">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Activity className="w-4 h-4" />
              </div>
              Guided Vitals Log
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-[340px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step + (selectedVital || "")}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {step === "selection" && renderSelection()}
                {step === "input" && renderInput()}
                {step === "confirmation" && renderConfirmation()}
                {step === "success" && renderSuccess()}
              </motion.div>
            </AnimatePresence>
          </div>

          {step !== "success" && (
            <DialogFooter className="mt-6 flex flex-row gap-3">
              {step !== "selection" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (step === "input") setStep("selection");
                    if (step === "confirmation") setStep("input");
                  }}
                  className="flex-1 h-12 rounded-2xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              {step === "input" && (
                <Button
                  onClick={() => setStep("confirmation")}
                  disabled={!canContinue}
                  className="flex-[2] h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-100"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
              {step === "confirmation" && (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100"
                >
                  {loading ? "Saving..." : "Save Reading"}
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              )}
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

