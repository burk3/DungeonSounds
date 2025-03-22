import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Playback from "@/pages/playback";
import Remote from "@/pages/remote";
import Admin from "@/pages/admin";
import { WebSocketProvider } from "./lib/websocket";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth-context";
import Login from "./components/login";
import RestrictedAccess from "./components/restricted-access";
import { Loader2 } from "lucide-react";

// Protected route component
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType, [key: string]: any }) {
  const { isAuthenticated, isLoading, isAllowed } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#2A2523] text-amber-200">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl">Loading...</span>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show restricted access if authenticated but not allowed
  if (!isAllowed) {
    return <RestrictedAccess />;
  }

  // Render the component if authenticated and allowed
  return <Component {...rest} />;
}

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
      <Route path="/playback">
        <Playback />
      </Route>
      <Route path="/remote">
        <ProtectedRoute component={Remote} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={Admin} />
      </Route>
      <Route>
        <NotFound />
      </Route>
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
