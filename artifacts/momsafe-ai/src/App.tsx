/// <reference types="vite/client" />
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  Redirect,
} from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, lazy, Suspense } from "react";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/layout/AppLayout";

// Code-split pages so authenticated/heavy bundles (Recharts, Leaflet, etc.) are only loaded on demand
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Vitals = lazy(() => import("@/pages/vitals"));
const Alerts = lazy(() => import("@/pages/alerts"));
const Analytics = lazy(() => import("@/pages/analytics"));
const AIGuidance = lazy(() => import("@/pages/ai-guidance"));
const Nutrition = lazy(() => import("@/pages/nutrition"));
const Medication = lazy(() => import("@/pages/medication"));
const DailyLogs = lazy(() => import("@/pages/daily-logs"));
const LocationPage = lazy(() => import("@/pages/LocationPage"));
const Settings = lazy(() => import("@/pages/settings"));
const Help = lazy(() => import("@/pages/help"));
const Login = lazy(() => import("@/pages/login"));
const Onboarding = lazy(() => import("@/pages/onboarding"));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
    </div>
  );
}

import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

function Router() {
  const { user, loading } = useAuth();
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [location] = useLocation();

  // If user navigates to /login, render Login page directly without delay or redirection
  if (location === "/login") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
      setNeedsOnboarding(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setNeedsOnboarding(!data?.full_name);
      setProfileChecked(true);
    })();
  }, [user]);

  if (loading || (user && !profileChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/terms">
            {() => {
              window.location.replace("/terms.html");
              return null;
            }}
          </Route>
          <Route path="/privacy">
            {() => {
              window.location.replace("/privacy.html");
              return null;
            }}
          </Route>
          <Route path="/">
            {() => {
              window.location.replace(import.meta.env.PROD ? "/" : "/landing.html");
              return null;
            }}
          </Route>
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Suspense>
    );
  }

  if (needsOnboarding) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/landing">
            {() => {
              window.location.replace("/landing.html");
              return null;
            }}
          </Route>
          <Route path="/terms">
            {() => {
              window.location.replace("/terms.html");
              return null;
            }}
          </Route>
          <Route path="/privacy">
            {() => {
              window.location.replace("/privacy.html");
              return null;
            }}
          </Route>
          <Route path="/login" component={Login} />
          <Route path="/onboarding">
            {() => <Onboarding onComplete={() => setNeedsOnboarding(false)} />}
          </Route>
          <Route>
            <Redirect to="/onboarding" />
          </Route>
        </Switch>
      </Suspense>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/vitals" component={Vitals} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/ai-guidance" component={AIGuidance} />
          <Route path="/nutrition" component={Nutrition} />
          <Route path="/medication" component={Medication} />
          <Route path="/daily-logs" component={DailyLogs} />
          <Route path="/hospitals" component={LocationPage} />
          <Route path="/settings" component={Settings} />
          <Route path="/help" component={Help} />
          <Route path="/onboarding">
            <Redirect to="/dashboard" />
          </Route>
          <Route path="/terms">
            {() => {
              window.location.href = "/terms.html";
              return null;
            }}
          </Route>
          <Route path="/privacy">
            {() => {
              window.location.href = "/privacy.html";
              return null;
            }}
          </Route>
          <Route path="/">
            <Redirect to="/dashboard" />
          </Route>
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster position="top-right" richColors />
        <VercelAnalytics />
        <SpeedInsights />
      </AuthProvider>
    </QueryClientProvider>
  );
}
