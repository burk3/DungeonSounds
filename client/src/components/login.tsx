import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, LogIn } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      // Auth state change will be handled by the AuthProvider
    } catch (error) {
      console.error('Login error:', error);
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: 'Unable to sign in with Google. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2A2523]">
      <Card className="w-[350px] border-[#5A3E32] bg-[#322B28] text-amber-50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-amber-400">D&D Soundboard</CardTitle>
          <CardDescription className="text-amber-200">
            Sign in to access your soundboard
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center space-x-2 rounded-md border border-amber-950 bg-[#3D312A] p-4">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div className="flex-1 space-y-1 text-sm text-amber-200">
              <p>Access is restricted to allowed users only.</p>
              <p>Contact your DM if you need access.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="w-full bg-gradient-to-br from-amber-700 to-amber-500 text-amber-50 hover:from-amber-600 hover:to-amber-400"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}