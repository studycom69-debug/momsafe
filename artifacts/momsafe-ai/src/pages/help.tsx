import { useState, useEffect, useCallback } from "react";
import { 
  HelpCircle, ChevronDown, ChevronUp, Send, MessageSquare, 
  Phone, Hospital, AlertCircle, Loader2, Clock, CheckCircle2,
  Search, Utensils, Activity, Bell, Shield, LifeBuoy, Mail, ExternalLink
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItem {
  question: string;
  answer: string;
  category: "Nutrition" | "Vitals" | "Alerts" | "Account";
  icon: any;
}

interface SupportRequest {
  id: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  created_at: string;
}

interface EmergencyContact {
  name: string;
  phone: string;
}

const FAQS: FAQItem[] = [
  {
    category: "Nutrition",
    icon: Utensils,
    question: "How to log meals?",
    answer: "Navigate to the Nutrition page from the sidebar. Click 'Log Meal', select the meal type (Breakfast, Lunch, Dinner, or Snack), and enter your food items. The AI will automatically calculate nutritional values."
  },
  {
    category: "Vitals",
    icon: Activity,
    question: "How to track vitals?",
    answer: "Go to the Vitals page. You can manually enter your Blood Pressure, Heart Rate, and SpO2. If you have connected devices, they will sync automatically when you open the app."
  },
  {
    category: "Alerts",
    icon: Bell,
    question: "How alerts work?",
    answer: "Our AI monitors your logs and vitals 24/7. If any value falls outside the safe clinical range for your pregnancy week, you'll receive an instant notification and it will appear in your Alerts tab."
  },
  {
    category: "Account",
    icon: Shield,
    question: "How to contact doctor?",
    answer: "Your OB/GYN's contact details are in Settings > Profile. In an emergency, use the 'Emergency Help' section on this page to quickly call your primary contact or emergency services."
  }
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;
  
  return (
    <motion.div 
      layout
      className={`border border-gray-100 rounded-2xl overflow-hidden transition-all ${isOpen ? 'bg-blue-50/30 border-blue-100 shadow-sm' : 'bg-white hover:border-blue-200'}`}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-5 text-left transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="flex-1 text-sm font-bold text-gray-800 tracking-tight">{item.question}</span>
        <div className={`p-1.5 rounded-lg transition-transform duration-300 ${isOpen ? 'rotate-180 bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-5 pb-5 pt-0 ml-14">
              <p className="text-sm text-gray-600 leading-relaxed font-medium">{item.answer}</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                <span className="px-2 py-0.5 bg-blue-100 rounded-md">{item.category}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Help() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FAQItem["category"] | "All">("All");
  
  // Form State
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  
  // Data State
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [primaryContact, setPrimaryContact] = useState<EmergencyContact | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const [requestRes, contactRes] = await Promise.all([
        supabase
          .from("support_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("emergency_contacts")
          .select("name, phone")
          .eq("user_id", user.id)
          .eq("is_primary", true)
          .maybeSingle()
      ]);

      setRequests(requestRes.data || []);
      setPrimaryContact(contactRes.data);
    } catch (err) {
      console.error("Error fetching help data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject || !message) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("support_requests")
        .insert([{
          user_id: user.id,
          subject,
          message,
          status: "open"
        }]);

      if (error) throw error;
      
      toast.success("Support request submitted");
      setSubject("");
      setMessage("");
      fetchData(); // Refresh list
    } catch (err) {
      console.error("Error submitting support request:", err);
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const categories: (FAQItem["category"] | "All")[] = ["All", "Nutrition", "Vitals", "Alerts", "Account"];

  const filteredFaqs = FAQS.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Header - Clean & Focused */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Help Center</h1>
          <p className="text-gray-500 font-medium text-lg">Find answers or start a conversation with support.</p>
        </div>
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* FAQ - Main Section (7/12) */}
        <div className="md:col-span-8 space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 px-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeCategory === cat 
                    ? "bg-gray-900 text-white shadow-lg shadow-gray-200" 
                    : "bg-white text-gray-400 hover:text-gray-900 border-2 border-gray-50 hover:border-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, i) => (
                  <motion.div 
                    key={faq.question}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <FAQAccordion item={faq} />
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-bold">No results found for your search.</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Contact Support - Integrated Card */}
          <div className="bg-white rounded-[2.5rem] border-2 border-gray-50 p-10 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Still stuck?</h2>
                <p className="text-gray-500 font-medium leading-relaxed">
                  Send our support team a message. We usually respond within a few hours to help resolve your issues.
                </p>
                <div className="flex items-center gap-4 pt-4">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200" />)}
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Support Team Online</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                  type="text" 
                  placeholder="What's the subject?"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-50 rounded-2xl py-3 px-5 text-sm font-medium focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
                  required
                />
                <textarea 
                  placeholder="Describe your issue..."
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-50 rounded-2xl py-3 px-5 text-sm font-medium focus:outline-none focus:border-purple-600 focus:bg-white transition-all resize-none"
                  required
                />
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-purple-700 hover:shadow-xl hover:shadow-purple-200 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Ticket
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar - Emergency & Activity (4/12) */}
        <div className="md:col-span-4 space-y-6">
          {/* Emergency - Ultra High Contrast */}
          <div className="bg-white border-4 border-red-600 rounded-[2.5rem] p-8 space-y-8 shadow-xl shadow-red-50 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Immediate Help</p>
                <p className="text-sm font-black text-gray-900 uppercase">Emergency</p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => window.location.href = "tel:102"}
                className="w-full group flex items-center justify-between p-5 bg-red-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200"
              >
                <div className="flex items-center gap-4">
                  <Phone className="w-5 h-5" />
                  <span>Call 102</span>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90 group-hover:translate-x-1 transition-transform" />
              </button>

              <Link href="/hospitals" className="block">
                <div className="w-full group flex items-center justify-between p-5 border-2 border-gray-100 bg-white text-red-600 rounded-[1.5rem] font-black uppercase tracking-widest hover:border-red-600 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Hospital className="w-5 h-5" />
                    <span>Hospitals</span>
                  </div>
                  <ChevronDown className="w-4 h-4 -rotate-90 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>

            {primaryContact && (
              <div className="pt-6 border-t border-gray-100 space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Your Primary Contact</p>
                <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border-2 border-gray-50">
                  <div>
                    <p className="text-sm font-black text-gray-900 tracking-tight">{primaryContact.name}</p>
                    <p className="text-xs text-gray-500 font-bold">{primaryContact.phone}</p>
                  </div>
                  <button 
                    onClick={() => window.location.href = `tel:${primaryContact.phone}`}
                    className="w-10 h-10 bg-white border-2 border-gray-100 text-red-600 rounded-xl flex items-center justify-center hover:border-red-600 hover:shadow-md transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity - Minimalist List */}
          <div className="bg-white border-2 border-gray-50 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Recent Activity</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-10 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                <LifeBuoy className="w-8 h-8 text-gray-300 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.slice(0, 4).map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-4 rounded-2xl border-2 border-transparent hover:border-amber-100 hover:bg-amber-50/30 transition-all group">
                    <div className="max-w-[180px]">
                      <p className="text-sm font-bold text-gray-800 truncate">{req.subject}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{format(new Date(req.created_at), "MMM d")}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${req.status === 'resolved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
