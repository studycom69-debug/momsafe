import { useState, useEffect, useCallback } from "react";
import {
  User,
  Bell,
  Shield,
  Phone,
  Baby,
  Save,
  Camera,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  X,
  Download,
  AlertTriangle,
  Mail,
  Hash,
  Droplets,
  Stethoscope,
  Hospital as HospitalIcon,
  Info,
  Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { motion, AnimatePresence } from "framer-motion";

const tabs = [
  "Profile",
  "Pregnancy",
  "Notifications",
  "Emergency Contacts",
  "Privacy",
] as const;

interface Contact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  is_primary: boolean;
}

interface NotificationSettings {
  critical_alerts: boolean;
  medication_reminders: boolean;
  vital_check_reminders: boolean;
  weekly_summary: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
}

interface PrivacySettings {
  share_with_doctor: boolean;
  ai_training: boolean;
  location_enabled: boolean;
}

function Toggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-gray-200"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  type?: string;
  onChange?: (val: string) => void;
  icon?: any;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={`w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "text-gray-700"}`}
      />
      {hint && (
        <p className="text-[10px] text-blue-500 font-medium mt-1 flex items-center gap-1">
          <span>↻</span> {hint}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange?: (val: string) => void;
  icon?: any;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none text-gray-700"
        >
          <option value="" disabled>
            Select {label}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>
    </div>
  );
}

const getTrimester = (week: number) => {
  if (week <= 12) return "First Trimester";
  if (week <= 26) return "Second Trimester";
  return "Third Trimester";
};

const getMilestone = (week: number) => {
  if (week <= 4) return "Early development: The neural tube is forming.";
  if (week <= 8) return "Heart starts beating and basic structures form.";
  if (week <= 12) return "Baby is fully formed and starting to move.";
  if (week <= 16) return "Baby can make sucking motions and swallow.";
  if (week <= 20)
    return "You might start feeling baby's movements (quickening).";
  if (week <= 24) return "Baby's lungs are developing and taste buds form.";
  if (week <= 28) return "Eyes can open and close, and baby is very active.";
  if (week <= 32)
    return "Baby is gaining weight rapidly and practicing breathing.";
  if (week <= 36) return "Baby is getting into position for birth (head down).";
  return "Full term: Baby is ready to meet the world!";
};

const calculateRiskStatus = (userData: any) => {
  if (!userData) return "Normal";
  const highRiskConditions = [
    "Hypertension",
    "Diabetes",
    "Preeclampsia",
    "Multiple Gestation",
  ];
  const hasCondition =
    userData.conditions &&
    highRiskConditions.some((c) =>
      userData.conditions.toLowerCase().includes(c.toLowerCase()),
    );
  const isAdvancedAge = userData.age > 35;
  const isVeryYoung = userData.age < 18;

  if (hasCondition || isAdvancedAge || isVeryYoung) return "Needs Monitoring";
  return "Normal";
};

export default function Settings() {
  const { user: authUser, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [tab, setTab] = useState<
    "Profile" | "Pregnancy" | "Notifications" | "Emergency Contacts" | "Privacy"
  >("Profile");

  // Notification State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    critical_alerts: true,
    medication_reminders: true,
    vital_check_reminders: false,
    weekly_summary: true,
    push_enabled: true,
    sms_enabled: false,
    email_enabled: true,
  });

  // Privacy State
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    share_with_doctor: true,
    ai_training: false,
    location_enabled: true,
  });

  // Emergency Contact State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    is_primary: false,
  });

  const fetchInitialData = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      const [userRes, notifRes, contactRes, privacyRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", authUser.id).maybeSingle(),
        supabase
          .from("notification_settings")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle(),
        supabase
          .from("emergency_contacts")
          .select("*")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("privacy_settings")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ]);

      if (userRes.data) setUserData(userRes.data);

      if (notifRes.data) {
        const { user_id, ...settings } = notifRes.data;
        setNotifSettings(settings);
      } else {
        const defaults = {
          user_id: authUser.id,
          critical_alerts: true,
          medication_reminders: true,
          vital_check_reminders: false,
          weekly_summary: true,
          push_enabled: true,
          sms_enabled: false,
          email_enabled: true,
        };
        // Use upsert to avoid race conditions and ensure uniqueness
        await supabase.from("notification_settings").upsert([defaults]);
        const { user_id, ...settingsForState } = defaults;
        setNotifSettings(settingsForState);
      }

      if (privacyRes.data) {
        setPrivacySettings(privacyRes.data);
      } else {
        const defaults = {
          user_id: authUser.id,
          share_with_doctor: true,
          ai_training: false,
          location_enabled: true,
        };
        // Use upsert for privacy settings as well
        await supabase.from("privacy_settings").upsert([defaults]);
        setPrivacySettings(defaults as any);
      }

      setContacts(contactRes.data || []);
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Calculate due date if gestational week is present but due date is not
  useEffect(() => {
    if (userData?.gestational_week && !userData?.due_date) {
      const today = new Date();
      const remainingWeeks = 40 - userData.gestational_week;
      const dueDate = new Date(
        today.getTime() + remainingWeeks * 7 * 24 * 60 * 60 * 1000,
      );
      setUserData({
        ...userData,
        due_date: dueDate.toISOString().split("T")[0],
      });
    }
  }, [userData?.gestational_week, userData?.due_date]);

  // Auto-advance gestational week as calendar time passes, derived from due date
  useEffect(() => {
    if (!userData?.due_date) return;
    const today = new Date();
    const due = new Date(userData.due_date);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksRemaining = Math.round(
      (due.getTime() - today.getTime()) / msPerWeek,
    );
    const autoWeek = Math.max(1, Math.min(42, 40 - weeksRemaining));
    if (autoWeek !== userData?.gestational_week) {
      setUserData((prev: any) => ({ ...prev, gestational_week: autoWeek }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.due_date]);

  // Auto-calculate BMI

  const saveProfile = async (message: string = "Profile updated") => {
    if (!authUser || !userData) return;
    setSaving(true);

    try {
      const { error } = await supabase.from("users").upsert(
        {
          id: authUser.id,
          full_name: userData.full_name,
          age: Number(userData.age) || null,
          blood_type: userData.blood_type,
          doctor_name: userData.doctor_name,
          hospital: userData.hospital,
          gestational_week: Number(userData.gestational_week) || null,
          due_date: userData.due_date || null,
          pregnancy_type: userData.pregnancy_type,
          parity: Number(userData.parity) || 0,
          pre_preg_weight: Number(userData.pre_preg_weight) || null,
          bmi: Number(userData.bmi) || null,
          conditions: userData.conditions,
          conception_method: userData.conception_method,
        },
        { onConflict: "id" },
      );

      if (error) throw error;
      toast.success(message);
    } catch (err: any) {
      console.error("saveProfile error:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = async (key: keyof NotificationSettings) => {
    if (!authUser) return;

    // Prevent disabling Critical Health Alerts
    if (key === "critical_alerts" && notifSettings.critical_alerts) {
      toast.error("Critical health alerts are required for your safety.", {
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      });
      return;
    }

    const newSettings = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(newSettings);

    try {
      const { error } = await supabase.from("notification_settings").upsert({
        user_id: authUser.id,
        ...newSettings,
      });

      if (error) throw error;
      toast.success("Preferences updated", { duration: 1000 });
    } catch (err) {
      console.error("Error updating notifications:", err);
      toast.error("Failed to update preferences");
      setNotifSettings(notifSettings); // Placeholder change to ensure replacement occurs, as no specific instruction was provided.
    }
  };

  const togglePrivacy = async (key: keyof PrivacySettings) => {
    if (!authUser) return;
    const newSettings = { ...privacySettings, [key]: !privacySettings[key] };
    setPrivacySettings(newSettings);

    try {
      const { error } = await supabase.from("privacy_settings").upsert({
        user_id: authUser.id,
        ...newSettings,
      });

      if (error) throw error;
      toast.success("Privacy settings updated", { duration: 1000 });
    } catch (err) {
      console.error("Error updating privacy:", err);
      toast.error("Failed to update privacy settings");
      setPrivacySettings(privacySettings);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authUser) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", authUser.id);

      if (error) throw error;

      await signOut();
      setLocation("/auth");
      toast.success("Account deleted successfully");
    } catch (err) {
      console.error("Error deleting account:", err);
      toast.error("Failed to delete account");
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!authUser) return;
    setSaving(true);

    try {
      const [user, vitals, water, sleep, mood, symptoms] = await Promise.all([
        supabase.from("users").select("*").eq("id", authUser.id).single(),
        supabase.from("vitals").select("*").eq("user_id", authUser.id),
        supabase.from("water_intake").select("*").eq("user_id", authUser.id),
        supabase.from("sleep_data").select("*").eq("user_id", authUser.id),
        supabase.from("mood_logs").select("*").eq("user_id", authUser.id),
        supabase.from("symptoms").select("*").eq("user_id", authUser.id),
      ]);

      const exportData = {
        profile: user.data,
        vitals: vitals.data,
        water_intake: water.data,
        sleep_data: sleep.data,
        mood_logs: mood.data,
        symptoms: symptoms.data,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `momsafe_data_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (err) {
      console.error("Error exporting data:", err);
      toast.error("Failed to export data");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setSaving(true);

    try {
      // If setting as primary, unset others
      if (contactForm.is_primary) {
        await supabase
          .from("emergency_contacts")
          .update({ is_primary: false })
          .eq("user_id", authUser.id);
      }

      if (editingContact) {
        const { error } = await supabase
          .from("emergency_contacts")
          .update(contactForm)
          .eq("id", editingContact.id);
        if (error) throw error;
        toast.success("Contact updated");
      } else {
        const { error } = await supabase
          .from("emergency_contacts")
          .insert([{ ...contactForm, user_id: authUser.id }]);
        if (error) throw error;
        toast.success("Contact added");
      }

      setShowContactModal(false);
      setEditingContact(null);
      setContactForm({
        name: "",
        relationship: "",
        phone: "",
        is_primary: false,
      });
      fetchInitialData();
    } catch (err) {
      console.error("Error saving contact:", err);
      toast.error("Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error } = await supabase
        .from("emergency_contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Contact deleted");
      fetchInitialData();
    } catch (err) {
      console.error("Error deleting contact:", err);
      toast.error("Failed to delete contact");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-gray-500">
          Loading your settings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Manage your profile, preferences, and account settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Tabs sidebar */}
        <div className="space-y-1">
          {[
            { key: "Profile", icon: User },
            { key: "Pregnancy", icon: Baby },
            { key: "Notifications", icon: Bell },
            { key: "Emergency Contacts", icon: Phone },
            { key: "Privacy", icon: Shield },
          ].map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${tab === key ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {key}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="col-span-3">
          <AnimatePresence mode="wait">
            {tab === "Profile" && (
              <motion.div
                key="Profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm"
              >
                {/* Profile Header */}
                <div className="flex items-center gap-6 mb-10">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-gray-400">
                      {userData?.full_name?.charAt(0) ||
                        authUser?.email?.charAt(0)}
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg border-2 border-white">
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {userData?.full_name || "New User"}
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Week {userData?.gestational_week || "--"} · Due:{" "}
                      {userData?.due_date || "--"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <Field
                    label="Full Name"
                    value={userData?.full_name}
                    onChange={(v) => setUserData({ ...userData, full_name: v })}
                  />
                  <Field
                    label="Age"
                    value={String(userData?.age || "")}
                    type="number"
                    onChange={(v) =>
                      setUserData({ ...userData, age: Number(v) })
                    }
                  />
                  <SelectField
                    label="Blood Type"
                    value={userData?.blood_type}
                    options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
                    onChange={(v) =>
                      setUserData({ ...userData, blood_type: v })
                    }
                  />

                  <Field
                    label="OB/GYN Provider"
                    value={userData?.doctor_name}
                    onChange={(v) =>
                      setUserData({ ...userData, doctor_name: v })
                    }
                  />
                  <Field
                    label="Hospital / Clinic"
                    value={userData?.hospital}
                    onChange={(v) => setUserData({ ...userData, hospital: v })}
                  />
                  <Field
                    label="Email Address"
                    value={authUser?.email || ""}
                    disabled={true}
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end mt-10">
                  <button
                    onClick={() => saveProfile("Profile updated")}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </motion.div>
            )}

            {tab === "Pregnancy" && (
              <motion.div
                key="Pregnancy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="card p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Pregnancy Details
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {getTrimester(userData?.gestational_week || 0)}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${calculateRiskStatus(userData) === "Normal" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      Risk: {calculateRiskStatus(userData)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Current Week"
                    value={String(userData?.gestational_week || "")}
                    type="number"
                    hint={
                      userData?.due_date
                        ? "Auto-updated weekly from your due date"
                        : undefined
                    }
                    onChange={(v) => {
                      const week = Number(v);
                      if (!isNaN(week) && week >= 1 && week <= 42)
                        setUserData({ ...userData, gestational_week: week });
                    }}
                  />
                  <Field
                    label="Due Date"
                    value={userData?.due_date}
                    type="date"
                    onChange={(v) => setUserData({ ...userData, due_date: v })}
                  />
                  <Field
                    label="Pregnancy Type"
                    value={userData?.pregnancy_type || "Singleton"}
                    onChange={(v) =>
                      setUserData({ ...userData, pregnancy_type: v })
                    }
                  />
                  <Field
                    label="Parity (previous births)"
                    value={String(userData?.parity || "0")}
                    type="number"
                    onChange={(v) =>
                      setUserData({ ...userData, parity: Number(v) })
                    }
                  />
                  <Field
                    label="Pre-pregnancy Weight (kg)"
                    value={String(userData?.pre_preg_weight || "")}
                    type="number"
                    onChange={(v) =>
                      setUserData({ ...userData, pre_preg_weight: Number(v) })
                    }
                  />
                  <Field
                    label="Starting BMI (Auto)"
                    value={String(userData?.bmi || "")}
                    disabled={true}
                  />
                  <Field
                    label="Pre-existing Conditions"
                    value={userData?.conditions || "None"}
                    onChange={(v) =>
                      setUserData({ ...userData, conditions: v })
                    }
                  />
                  <Field
                    label="Conception Method"
                    value={userData?.conception_method || "Natural"}
                    onChange={(v) =>
                      setUserData({ ...userData, conception_method: v })
                    }
                  />
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    Week {userData?.gestational_week} Milestone
                  </p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    {getMilestone(userData?.gestational_week || 0)}
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => saveProfile("Pregnancy details updated")}
                    disabled={saving}
                    className="action-btn"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </motion.div>
            )}

            {tab === "Notifications" && (
              <motion.div
                key="Notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="card p-6 space-y-5"
              >
                <h2 className="text-sm font-semibold text-gray-700">
                  Notification Preferences
                </h2>
                <div className="space-y-1">
                  <p className="section-label mb-3">Alert Types</p>
                  <p className="text-[10px] text-blue-600 font-medium mb-3 flex items-center gap-1.5 px-3 py-1 bg-blue-50/50 rounded-lg w-fit">
                    <Info className="w-3 h-3" /> Notifications are based on
                    real-time health monitoring
                  </p>
                  {[
                    {
                      key: "critical_alerts" as const,
                      label: "Critical Health Alerts",
                      desc: "Immediate notifications for abnormal vitals",
                    },
                    {
                      key: "medication_reminders" as const,
                      label: "Medication Reminders",
                      desc: "Daily reminders for scheduled medications",
                    },
                    {
                      key: "vital_check_reminders" as const,
                      label: "Vital Check Reminders",
                      desc: "Hourly or scheduled vital logging prompts",
                    },
                    {
                      key: "weekly_summary" as const,
                      label: "Weekly AI Summary",
                      desc: "Weekly report of trends and recommendations",
                    },
                  ].map((n) => (
                    <div
                      key={n.key}
                      className="flex items-center justify-between py-3 border-b border-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {n.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.desc}</p>
                      </div>
                      <Toggle
                        on={notifSettings[n.key]}
                        onToggle={() => toggleNotification(n.key)}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="section-label mb-3">Delivery Channels</p>
                  {[
                    {
                      key: "push_enabled" as const,
                      label: "Push Notifications",
                    },
                    {
                      key: "sms_enabled" as const,
                      label: "SMS / Text Message",
                    },
                    { key: "email_enabled" as const, label: "Email Digest" },
                  ].map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center justify-between py-3 border-b border-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {c.label}
                      </p>
                      <Toggle
                        on={notifSettings[c.key]}
                        onToggle={() => toggleNotification(c.key)}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {tab === "Emergency Contacts" && (
              <motion.div
                key="Emergency Contacts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="card p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Emergency Contacts
                  </h2>
                  <button
                    onClick={() => {
                      setEditingContact(null);
                      setContactForm({
                        name: "",
                        relationship: "",
                        phone: "",
                        is_primary: false,
                      });
                      setShowContactModal(true);
                    }}
                    className="ghost-btn text-xs"
                  >
                    <Plus className="w-3 h-3" /> Add Contact
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                    <Phone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">
                      No emergency contacts added yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-sm font-bold text-blue-700">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">
                                {c.name}
                              </p>
                              {c.is_primary && (
                                <span className="badge-blue text-[9px] uppercase tracking-tighter">
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 font-medium">
                              {c.relationship} · {c.phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingContact(c);
                              setContactForm({
                                name: c.name,
                                relationship: c.relationship,
                                phone: c.phone,
                                is_primary: c.is_primary,
                              });
                              setShowContactModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-700 leading-relaxed font-medium">
                    Emergency contacts will be notified automatically for
                    Critical alerts if you do not respond within 15 minutes.
                  </p>
                </div>
              </motion.div>
            )}

            {tab === "Privacy" && (
              <motion.div
                key="Privacy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="card p-6 space-y-5"
              >
                <h2 className="text-sm font-semibold text-gray-700">
                  Data & Privacy
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      key: "share_with_doctor" as const,
                      title: "Data Sharing with OB",
                      desc: "Allow your OB to access your MomSafe dashboard in read-only mode.",
                    },
                    {
                      key: "ai_training" as const,
                      title: "AI Training Opt-In",
                      desc: "Allow anonymized data to improve AI model accuracy.",
                    },
                    {
                      key: "location_enabled" as const,
                      title: "Location Services",
                      desc: "Used for hospital directions during emergencies.",
                    },
                  ].map((p) => (
                    <div
                      key={p.title}
                      className="flex items-start justify-between gap-4 py-3 border-b border-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {p.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                          {p.desc}
                        </p>
                      </div>
                      <Toggle
                        on={privacySettings[p.key]}
                        onToggle={() => togglePrivacy(p.key)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="ghost-btn text-xs text-red-500 border-red-200 hover:bg-red-50"
                  >
                    Delete Account
                  </button>
                  <button
                    onClick={handleExportData}
                    disabled={saving}
                    className="ghost-btn text-xs"
                  >
                    <Download className="w-3 h-3" />
                    {saving ? "Exporting..." : "Export My Data"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Delete Account?
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              Are you sure? This action is permanent and will delete all your
              health records, logs, and settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-100 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingContact ? "Edit Contact" : "Add Emergency Contact"}
              </h2>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-6 space-y-4">
              <Field
                label="Full Name"
                value={contactForm.name}
                onChange={(v) => setContactForm({ ...contactForm, name: v })}
              />
              <Field
                label="Relationship"
                value={contactForm.relationship}
                onChange={(v) =>
                  setContactForm({ ...contactForm, relationship: v })
                }
              />
              <Field
                label="Phone Number"
                value={contactForm.phone}
                type="tel"
                onChange={(v) => setContactForm({ ...contactForm, phone: v })}
              />

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    Primary Contact
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Notify this person first in emergencies
                  </p>
                </div>
                <Toggle
                  on={contactForm.is_primary}
                  onToggle={() =>
                    setContactForm({
                      ...contactForm,
                      is_primary: !contactForm.is_primary,
                    })
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !contactForm.name || !contactForm.phone}
                  className="flex-1 action-btn py-2.5"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingContact ? "Update" : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
