import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DemoAuthGate } from "@/components/demo-auth-gate";
import { LanguageProvider } from "@/context/language-context";
import NotFound from "@/pages/not-found";
import HostDashboard from "@/pages/HostDashboard";
import Auth from "@/pages/Auth";
import GuestDashboard from "@/pages/GuestDashboard";
import ModeSelect from "@/pages/ModeSelect";
import PropertySelect from "@/pages/PropertySelect";
import AdminPayment from "@/pages/AdminPayment";

function SignupRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/auth");
  }, [setLocation]);

  return null;
}

function GuestRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/guest");
  }, [setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HostDashboard} />
      <Route path="/auth" component={Auth} />
      <Route path="/mode" component={ModeSelect} />
      <Route path="/properties" component={PropertySelect} />
      <Route path="/admin/payment" component={AdminPayment} />
      <Route path="/signup" component={SignupRedirect} />
      <Route path="/login" component={SignupRedirect} />
      <Route path="/host/signup" component={SignupRedirect} />
      <Route path="/guest/signup" component={SignupRedirect} />
      <Route path="/guest" component={GuestDashboard} />
      <Route path="/guest/profile" component={GuestRedirect} />
      <Route path="/guest/messages" component={GuestRedirect} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <DemoAuthGate>
            <Router />
          </DemoAuthGate>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
