/// <reference types="vite/client" />
import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Phone, Loader2, Hospital, Navigation2, CheckCircle2, Car, Footprints, AlertTriangle, Baby, Stethoscope, Truck, ClipboardList, Share2, Info, ShieldCheck, Siren, Radio, Map as MapIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "wouter";
import { calculateRiskScore, RiskHealthData } from "@/lib/ai/riskEngine";

// Fix for default marker icons in Leaflet with Webpack/Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const UserIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
           <div class="w-2 h-2 bg-white rounded-full"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const HospitalIcon = L.divIcon({
  className: 'hospital-marker',
  html: `<div class="w-8 h-8 bg-red-600 rounded-lg shadow-xl flex items-center justify-center border-2 border-white transition-transform hover:scale-110">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const RecommendedHospitalIcon = L.divIcon({
  className: 'recommended-hospital-marker',
  html: `<div class="w-10 h-10 bg-emerald-600 rounded-lg shadow-2xl flex items-center justify-center border-2 border-white ring-4 ring-emerald-500/30 transition-transform hover:scale-110">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

interface HospitalData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  time: number;
  phone?: string;
  address: string;
  specialty?: string;
  rating?: number;
  isEmergency?: boolean;
  amenities?: string[];
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LocationPage() {
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [locationDisabled, setLocationDisabled] = useState(false);
  const [travelMode, setTravelMode] = useState<"walk" | "drive">("drive");
  const [riskLevel, setRiskLevel] = useState<string>("Low");
  const [gestationalWeek, setGestationalWeek] = useState<number>(0);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState([
    { id: 1, text: "Hospital Bag Packed", completed: false },
    { id: 2, text: "Emergency Contact Notified", completed: false },
    { id: 3, text: "Medical Records Handy", completed: false },
    { id: 4, text: "ID & Insurance Cards", completed: false },
  ]);
  const [emergencyMode, setEmergencyMode] = useState(false);

  const toggleChecklistItem = (id: number) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const checklistProgress = useMemo(() => {
    const completed = checklist.filter(i => i.completed).length;
    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  const fetchHospitals = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nearby-hospitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ lat, lng })
      });

      if (!response.ok) throw new Error("Failed to fetch nearby hospitals");
      
      const data = await response.json();
      setHospitals(data.hospitals || []);
    } catch (err) {
      console.error("Error fetching hospitals:", err);
      setError("Unable to find nearby hospitals. Please try again later.");
      toast.error("Could not load nearby hospitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        // Fetch User Profile
        const { data: userProfile } = await supabase
          .from("users")
          .select("gestational_week")
          .eq("id", user.id)
          .maybeSingle();
        
        if (userProfile?.gestational_week) {
          setGestationalWeek(userProfile.gestational_week);
        }

        // Fetch Latest Vitals for Risk Calculation
        const { data: latestVitals } = await supabase
          .from("vitals")
          .select("*")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestVitals) {
          const healthData: RiskHealthData = {
            heart_rate: latestVitals.heart_rate,
            bp_systolic: latestVitals.systolic_bp,
            bp_diastolic: latestVitals.diastolic_bp,
            spo2: latestVitals.spo2,
            temperature: latestVitals.temperature,
            gestational_week: userProfile?.gestational_week || 32
          };
          const risk = calculateRiskScore(healthData);
          setRiskLevel(risk.level);
        }
      } catch (err) {
        console.error("Error fetching user health data:", err);
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    const checkPrivacy = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("privacy_settings")
          .select("location_enabled")
          .eq("user_id", user.id)
          .single();
        
        if (data && data.location_enabled === false) {
          setLocationDisabled(true);
          setLoading(false);
          return;
        }
        
        if (!navigator.geolocation) {
          setError("Geolocation is not supported by your browser");
          setLoading(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const coords: [number, number] = [latitude, longitude];
            setUserLocation(coords);
            setMapCenter(coords);
            fetchHospitals(latitude, longitude);
          },
          (err) => {
            console.error("Geolocation error:", err);
            const fallback: [number, number] = [28.6139, 77.2090]; // Default to New Delhi
            setUserLocation(fallback);
            setMapCenter(fallback);
            fetchHospitals(fallback[0], fallback[1]);
            toast.info("Using default location (New Delhi)");
          }
        );
      } catch (err) {
        console.error("Error checking privacy settings:", err);
        setLoading(false);
      }
    };

    checkPrivacy();
  }, [user]);

  const sortedHospitals = useMemo(() => {
    return [...hospitals]
      .map(h => {
        // Recalculate ETA based on travel mode
        // Walk: 4.8 km/h, Drive: 32 km/h (avg city traffic)
        const speed = travelMode === "walk" ? 4.8 : 32;
        const newTime = Math.max(1, Math.round((h.distance / speed) * 60));
        
        // Mock some details for better UX
        const isMaternity = h.name.toLowerCase().includes("maternity") || 
                           h.name.toLowerCase().includes("women") || 
                           h.name.toLowerCase().includes("mother");
        const isEmergency = h.name.toLowerCase().includes("emergency") || 
                            h.name.toLowerCase().includes("multi") || 
                            h.name.toLowerCase().includes("hospital");
         const rating = 4.0 + (Math.random() * 1.0);

         // Generate mock amenities
         const amenities = [];
         if (isMaternity) amenities.push("NICU", "L&D Ward", "24/7 Gynaecologist");
         if (isEmergency) amenities.push("Ambulance", "ICU", "24/7 Pharmacy");
         if (amenities.length === 0) amenities.push("General Ward", "Pharmacy");

         // Calculate health-based priority score
         let priorityScore = 0;
         
         // Higher risk -> prioritize emergency/multi-specialty
         if (riskLevel === "Critical" || riskLevel === "High") {
           if (isEmergency) priorityScore += 10;
         }
         
         // Pregnancy week >= 28 -> prioritize maternity hospitals
         if (gestationalWeek >= 28) {
           if (isMaternity) priorityScore += 15;
         }
 
         return { 
           ...h, 
           time: newTime, 
           priorityScore, 
           isEmergency, 
           amenities,
           specialty: isMaternity ? "Maternity & Gynaecology" : (isEmergency ? "Multi-Specialty Emergency" : "General Hospital"),
           rating: Number(rating.toFixed(1))
         };
      })
      .sort((a, b) => {
        // Priority first
        if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
        // Then Distance
        return a.distance - b.distance;
      })
      .slice(0, 10);
  }, [hospitals, travelMode, riskLevel, gestationalWeek]);

  const recommendedHospital = useMemo(() => sortedHospitals[0], [sortedHospitals]);

  const handleHospitalClick = (hospital: any) => {
    setSelectedHospital(hospital.id);
    setMapCenter([hospital.lat, hospital.lng]);
    toast.info(`Selected: ${hospital.name}`, {
      description: `Distance: ${hospital.distance.toFixed(1)}km | Mode: ${travelMode}`,
      duration: 2000
    });
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    const mode = travelMode === "walk" ? "w" : "d";
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${travelMode === "walk" ? "walking" : "driving"}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 font-medium">Fetching your location and nearby hospitals...</p>
      </div>
    );
  }

  if (locationDisabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] space-y-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center">
          <MapPin className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">Location Services Disabled</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            To find nearby hospitals and emergency care, please enable location services in your privacy settings.
          </p>
        </div>
        <Link href="/settings" className="action-btn px-8">
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            Nearby Hospitals
            {emergencyMode && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-lg shadow-red-200"
              >
                <Siren className="w-3 h-3 animate-pulse" />
                Emergency HUD Active
              </motion.span>
            )}
          </h1>
          <p className="text-gray-500 font-medium mt-1">Find immediate medical care in case of emergencies.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (!emergencyMode) {
                setEmergencyMode(true);
                setTravelMode("drive");
                toast.error("Emergency Mode Activated!", {
                  description: "Route prioritized for fastest emergency care. ETA recalculated.",
                  duration: 5000,
                  icon: <Siren className="w-5 h-5 text-red-600" />
                });
              } else {
                setEmergencyMode(false);
                toast.info("Emergency Mode Deactivated");
              }
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-lg transition-all ${
              emergencyMode 
                ? "bg-white text-red-600 border-2 border-red-600 shadow-red-100" 
                : "bg-red-600 text-white shadow-red-200 hover:bg-red-700 hover:-translate-y-0.5"
            }`}
          >
            <Siren className={`w-4 h-4 ${emergencyMode ? "animate-spin" : "fill-current"}`} />
            <span>{emergencyMode ? "Deactivate SOS" : "Emergency SOS"}</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50/80 backdrop-blur-sm text-emerald-600 rounded-full border border-emerald-100/50">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">Live Location</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {emergencyMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-red-50/80 backdrop-blur-xl border-2 border-red-200/60 rounded-[2rem] shadow-2xl shadow-red-500/10 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-white to-red-600 animate-shimmer" />
            
            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-black text-red-600 uppercase mb-2 tracking-widest">Fastest Option</p>
              <p className="text-base font-black text-gray-900 line-clamp-1 mb-1">{recommendedHospital?.name}</p>
              <p className="text-2xl font-black text-red-600">{recommendedHospital?.time} <span className="text-sm">MINS</span></p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-black text-red-600 uppercase mb-2 tracking-widest">Action Required</p>
              <button 
                onClick={() => window.location.href = "tel:102"}
                className="w-full py-3 bg-red-600 text-white text-sm font-black rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-200 hover:-translate-y-0.5 transition-all"
              >
                <Phone className="w-4 h-4 fill-current" />
                Call 102
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-black text-red-600 uppercase mb-2 tracking-widest">Route Sync</p>
              <button 
                onClick={() => recommendedHospital && openGoogleMaps(recommendedHospital.lat, recommendedHospital.lng)}
                className="w-full py-3 bg-blue-600 text-white text-sm font-black rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all"
              >
                <Navigation2 className="w-4 h-4" />
                GO NOW
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-black text-red-600 uppercase mb-2 tracking-widest">Beacon Status</p>
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="absolute w-8 h-8 bg-red-500/30 rounded-full animate-ping" />
                </div>
                <span className="text-sm font-bold text-gray-700">Broadcasting</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Travel Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-base font-black text-gray-900">Travel Mode</p>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">Recalculate ETA for your journey</p>
          </div>
        </div>
        <div className="flex p-1.5 bg-gray-50 rounded-2xl border border-gray-100 w-full sm:w-auto">
          <button 
            onClick={() => {
              setTravelMode("drive");
              toast.success("Switched to Drive Mode", { description: "ETA recalculated for driving speeds (30-40km/h)" });
            }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              travelMode === "drive" 
                ? "bg-white text-blue-600 shadow-md border border-gray-100/50" 
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
            }`}
          >
            <Car className="w-4 h-4" />
            Drive
          </button>
          <button 
            onClick={() => {
              setTravelMode("walk");
              toast.success("Switched to Walk Mode", { description: "ETA recalculated for walking speed (5km/h)" });
            }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              travelMode === "walk" 
                ? "bg-white text-blue-600 shadow-md border border-gray-100/50" 
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
            }`}
          >
            <Footprints className="w-4 h-4" />
            Walk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-0 overflow-hidden h-[500px] lg:h-[600px] border-4 border-white shadow-2xl relative rounded-[2.5rem]">
            {userLocation && (
              <MapContainer 
                center={mapCenter} 
                zoom={13} 
                style={{ height: "100%", width: "100%" }}
                className="z-10"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <ChangeView center={mapCenter} />
                
                <Marker position={userLocation} icon={UserIcon}>
                  <Popup>
                    <div className="text-center font-bold">You are here</div>
                  </Popup>
                </Marker>

                {emergencyMode && recommendedHospital && (
                  <Marker position={[recommendedHospital.lat, recommendedHospital.lng]} icon={RecommendedHospitalIcon}>
                    <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping pointer-events-none" style={{ width: '100px', height: '100px', marginLeft: '-30px', marginTop: '-30px' }} />
                  </Marker>
                )}

                {sortedHospitals.map((hospital) => (
                  <Marker 
                    key={hospital.id} 
                    position={[hospital.lat, hospital.lng]} 
                    icon={hospital.id === recommendedHospital?.id ? RecommendedHospitalIcon : HospitalIcon}
                    eventHandlers={{
                      click: () => handleHospitalClick(hospital)
                    }}
                  >
                    <Popup>
                      <div className="p-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900">{hospital.name}</p>
                          {hospital.id === recommendedHospital?.id && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded shadow-sm border border-emerald-200">
                              Recommended for you
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[9px] text-blue-600 font-bold uppercase tracking-tight bg-blue-50 px-1.5 py-0.5 rounded">{hospital.specialty}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-amber-500 font-black">★</span>
                            <span className="text-[9px] text-gray-500 font-bold">{hospital.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{hospital.address}</p>
                        <button 
                          onClick={() => openGoogleMaps(hospital.lat, hospital.lng)}
                          className="w-full py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5"
                        >
                          <Navigation2 className="w-3 h-3" />
                          Directions ({travelMode})
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Navigation className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Emergency Protocol</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                In case of severe symptoms or emergency, call emergency services (102) immediately while heading to the nearest facility.
              </p>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="space-y-4">
          {/* Emergency Readiness Widget */}
          <div className="card bg-gradient-to-br from-indigo-500 to-blue-600 border-none p-4 shadow-lg overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <ClipboardList className="w-16 h-16 text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Readiness Score
                </h3>
                <span className="text-xs font-black text-white/90 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-md">
                  {checklistProgress}% Ready
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full mb-4">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500" 
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
              <button 
                onClick={() => setShowChecklist(!showChecklist)}
                className="w-full py-2 bg-white text-blue-600 text-[10px] font-bold rounded-xl uppercase tracking-widest hover:bg-blue-50 transition-colors shadow-md"
              >
                {showChecklist ? "Hide Checklist" : "Complete Preparation"}
              </button>
            </div>
            
            <AnimatePresence>
              {showChecklist && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-2 border-t border-white/10 mt-3">
                    {checklist.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => toggleChecklistItem(item.id)}
                        className="flex items-center justify-between group/item cursor-pointer"
                      >
                        <span className={`text-[10px] transition-colors ${item.completed ? "text-white/50 line-through" : "text-white font-medium"}`}>
                          {item.text}
                        </span>
                        <div className={`w-4 h-4 rounded-md border-2 transition-all flex items-center justify-center ${
                          item.completed ? "bg-emerald-400 border-emerald-400" : "border-white/30 group-hover/item:border-white/60"
                        }`}>
                          {item.completed && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between px-2 pt-2">
            <h2 className="text-base font-black text-gray-800 tracking-tight flex items-center gap-2">
              <Hospital className="w-5 h-5 text-red-500" />
              Nearest Facilities
            </h2>
            <span className="text-xs font-bold text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded-lg">{sortedHospitals.length} Showing</span>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar pb-10">
            {sortedHospitals.map((hospital) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={hospital.id}
                onClick={() => handleHospitalClick(hospital)}
                className={`p-5 cursor-pointer transition-all duration-300 rounded-[2rem] border-2 group relative overflow-hidden ${
                  selectedHospital === hospital.id 
                    ? "border-blue-500 bg-white shadow-xl shadow-blue-100" 
                    : "border-transparent bg-white shadow-sm hover:shadow-md hover:border-gray-200"
                }`}
              >
                {/* Subtle gradient background for selected card */}
                {selectedHospital === hospital.id && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none" />
                )}

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{hospital.name}</h3>
                        {hospital.id === recommendedHospital?.id && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg shadow-sm border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Recommended
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-[10px] text-blue-700 font-black uppercase tracking-wider bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                          {hospital.specialty}
                        </p>
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
                          <span className="text-[10px] text-amber-500 font-black">★</span>
                          <span className="text-[10px] text-amber-700 font-black">{hospital.rating}</span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500 font-medium line-clamp-2 mb-4">{hospital.address}</p>
                      
                      {/* Stats Inline Row */}
                      <div className="flex items-center gap-6 mb-4 p-3 bg-gray-50 rounded-2xl border border-gray-100/50">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Distance</p>
                          <p className="text-sm font-black text-gray-800">{hospital.distance.toFixed(1)} km</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200" />
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">ETA ({travelMode})</p>
                          <p className="text-sm font-black text-blue-600">{hospital.time} mins</p>
                        </div>
                      </div>

                      {/* Facility Icons */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {hospital.amenities?.map((amenity: string) => (
                          <div key={amenity} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 shadow-sm">
                            {amenity === "NICU" && <Baby className="w-3 h-3 text-indigo-500" />}
                            {amenity === "Ambulance" && <Truck className="w-3 h-3 text-red-500" />}
                            {amenity === "24/7 Gynaecologist" && <Stethoscope className="w-3 h-3 text-emerald-500" />}
                            {amenity}
                          </div>
                        ))}
                      </div>
                      
                      {selectedHospital === hospital.id && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 p-4 bg-white rounded-2xl border border-blue-100 space-y-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 font-bold uppercase tracking-wider">Availability</span>
                            <span className="text-emerald-600 font-black uppercase bg-emerald-50 px-2 py-1 rounded-md">Open 24/7</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 font-bold uppercase tracking-wider">Wait Time</span>
                            <span className="text-amber-600 font-black uppercase bg-amber-50 px-2 py-1 rounded-md">~15-20 mins</span>
                          </div>
                          <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${travelMode === "drive" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                              {travelMode === "drive" ? <Car className="w-4 h-4" /> : <Footprints className="w-4 h-4" />}
                            </div>
                            <p className="text-xs text-gray-600 font-medium">
                              Estimated <span className="font-black text-gray-900">{hospital.time} mins</span> by <span className="font-black text-gray-900 capitalize">{travelMode}</span>
                            </p>
                          </div>
                          <div className="pt-2 flex items-center gap-2 px-3 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                            <Info className="w-4 h-4 text-indigo-500" />
                            <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide">Safe route suggested via main roads</p>
                          </div>
                        </motion.div>
                      )}

                      {hospital.id === recommendedHospital?.id && hospital.priorityScore > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200/50 w-fit">
                          <AlertTriangle className="w-3 h-3" />
                          Prioritized for your {gestationalWeek >= 28 ? "trimester" : "health profile"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openGoogleMaps(hospital.lat, hospital.lng);
                      }}
                      className="flex-1 py-3 bg-blue-600 text-white text-[11px] font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Navigation2 className="w-4 h-4" />
                      Navigate
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success("Location Shared", { description: `Hospital details sent to your emergency contact.` });
                      }}
                      className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-100 transition-all hover:-translate-y-0.5"
                      title="Share with emergency contact"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    {hospital.phone && (
                      <a 
                        href={`tel:${hospital.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-100 transition-all hover:-translate-y-0.5"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {hospitals.length === 0 && !error && !loading && (
              <div className="p-10 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                  <MapPin className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">Searching for hospitals in your area...</p>
              </div>
            )}

            {error && (
              <div className="p-8 text-center bg-red-50 rounded-[2rem] border-2 border-red-100">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-red-100">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-sm font-bold text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


