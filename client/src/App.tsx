import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Playback from "@/pages/playback";
import Remote from "@/pages/remote";
import { WebSocketProvider } from "./lib/websocket";
import { AuthProvider } from "./lib/auth";
import { useEffect } from "react";

function Router() {
  const [location, setLocation] = useLocation();

  // Redirect to playback if path is just "/"
  useEffect(() => {
    if (location === "/") {
      setLocation("/playback");
    }
  }, [location, setLocation]);

  return (
    <Switch>
      <Route path="/playback" component={Playback} />
      <Route path="/remote" component={Remote} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <Router />
          <Toaster />
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
