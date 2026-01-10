import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DemoAuthGate } from "@/components/demo-auth-gate";
import NotFound from "@/pages/not-found";
import HostDashboard from "@/pages/HostDashboard";
import HostSignup from "@/pages/HostSignup";
import GuestProfile from "@/pages/GuestProfile";
import GuestDashboard from "@/pages/GuestDashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HostDashboard} />
      <Route path="/host/signup" component={HostSignup} />
      <Route path="/guest/profile" component={GuestProfile} />
      <Route path="/guest/messages" component={GuestDashboard} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <DemoAuthGate>
          <Router />
        </DemoAuthGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
