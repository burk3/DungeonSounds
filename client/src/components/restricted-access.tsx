import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ban, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function RestrictedAccess() {
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2A2523]">
      <Card className="w-[450px] border-[#5A3E32] bg-[#322B28] text-amber-50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-amber-400">Access Restricted</CardTitle>
          <CardDescription className="text-amber-200">
            You don't have permission to access this soundboard
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center space-x-2 rounded-md border border-amber-950 bg-[#3D312A] p-4">
            <Ban className="h-6 w-6 text-red-500" />
            <div className="flex-1 space-y-1 text-sm text-amber-200">
              <p className="font-semibold text-amber-100">
                Your account is not on the allowed users list
              </p>
              <p>
                The email {user?.email} is not authorized to access this application. 
                Please contact the DM or administrator to request access.
              </p>
            </div>
          </div>
          <Button 
            onClick={logout} 
            variant="outline"
            className="border-amber-700 bg-transparent text-amber-400 hover:bg-amber-900 hover:text-amber-200"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out and try another account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}