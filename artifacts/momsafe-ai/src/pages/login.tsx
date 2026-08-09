import { supabase } from "@/lib/supabase";
import { FcGoogle } from "react-icons/fc";
import { ShieldCheck, Heart } from "lucide-react";

export default function Login() {
  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Error signing in with Google:", error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            MomSafe AI
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Premium AI-powered maternity care and health monitoring.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Secure Access</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FcGoogle className="h-5 w-5" />
            Continue with Google
          </button>

          <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-medium">
            Protected by Enterprise-grade AI & Encryption
          </p>
        </div>

        <div className="pt-6 border-t border-gray-100 mt-6 flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
          <span className="text-xs text-gray-400">Designed with care for expectant mothers</span>
        </div>
      </div>
    </div>
  );
}
