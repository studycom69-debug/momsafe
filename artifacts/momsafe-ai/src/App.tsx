/// <reference types="vite/client" />
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/dashboard";
import Vitals from "@/pages/vitals";
import Alerts from "@/pages/alerts";
import Analytics from "@/pages/analytics";
import AIGuidance from "@/pages/ai-guidance";
import Nutrition from "@/pages/nutrition";
import Medication from "@/pages/medication";
import DailyLogs from "@/pages/daily-logs";
import LocationPage from "@/pages/LocationPage";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import Login from "@/pages/login";

import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  return (
    <AppLayout>
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
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
