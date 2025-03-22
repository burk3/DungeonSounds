import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminPanel from "@/components/admin-panel";
import Header from "@/components/header";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isAllowed, isAdmin, isLoading } = useAuth();
  
  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate("/remote");
      } else if (!isAllowed || !isAdmin) {
        navigate("/remote");
      }
    }
  }, [isAuthenticated, isAllowed, isAdmin, isLoading, navigate]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#2A2523] text-amber-200">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl">Loading...</span>
      </div>
    );
  }
  
  // Access denied state
  if (!isAdmin) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-[#2A2523] text-amber-200">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
        <p className="text-amber-200/80 text-center max-w-md">
          You need admin privileges to access this page.
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-[#2A2523] min-h-screen text-amber-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-amber-400 mb-2">Admin Dashboard</h1>
          <p className="text-amber-200/70">Manage your D&D Sound Board</p>
        </div>
        
        <Tabs defaultValue="invites" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="invites">Invite Management</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="invites">
            <AdminPanel queryClient={queryClient} />
          </TabsContent>
          
          <TabsContent value="users">
            <Card className="bg-[#1F1B19] border-amber-800/50">
              <CardHeader>
                <CardTitle className="text-xl text-amber-400">User Management</CardTitle>
                <CardDescription>Manage existing users (coming soon)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-amber-200/70 py-4">
                  User management features will be available in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}