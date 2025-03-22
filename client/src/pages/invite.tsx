import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { signInWithGoogle } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ValidateInviteCodeResponse } from "@shared/schema";

interface InvitePageProps {
  code: string;
}

export default function InvitePage({ code }: InvitePageProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [validatingCode, setValidatingCode] = useState(true);
  const [isValidCode, setIsValidCode] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Validate the invite code on component mount
  useEffect(() => {
    async function validateCode() {
      try {
        setValidatingCode(true);
        const response = await apiRequest<ValidateInviteCodeResponse>({
          url: `/api/invite/${code}/validate`,
          method: "GET"
        });
        
        setIsValidCode(response.valid);
        setMessage(response.message || null);
      } catch (error) {
        console.error("Error validating invite code:", error);
        setIsValidCode(false);
        setMessage("Error validating invite code. Please try again.");
      } finally {
        setValidatingCode(false);
      }
    }

    validateCode();
  }, [code]);

  // Handle redeem button click
  const handleRedeem = async () => {
    if (!isAuthenticated || !user || isRedeeming) {
      return;
    }

    try {
      setIsRedeeming(true);
      
      // Redeem the invite code
      await apiRequest({
        url: `/api/invite/${code}/redeem`,
        method: "POST",
        body: {
          email: user.email,
          displayName: user.displayName,
          uid: user.uid
        }
      });
      
      toast({
        title: "Success!",
        description: "You are now registered. Redirecting to the remote control...",
        variant: "default",
      });
      
      // Redirect to remote page after successful redemption
      setTimeout(() => navigate("/remote"), 2000);
    } catch (error: any) {
      console.error("Error redeeming invite code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to redeem invite code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2A2523] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-amber-400">D&D Sound Board Invite</CardTitle>
          <CardDescription className="text-muted-foreground">
            You've been invited to join the D&D Sound Board
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {validatingCode ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              <p className="mt-4 text-center">Validating your invite code...</p>
            </div>
          ) : isValidCode ? (
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="mt-4 text-center text-lg">Valid invite code!</p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {isAuthenticated 
                  ? "Click the button below to join."
                  : "Please sign in with Google to continue."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="mt-4 text-center text-lg">Invalid invite code</p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {message || "This invite code is invalid or has expired."}
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center">
          {isValidCode ? (
            isAuthenticated ? (
              <Button 
                variant="default" 
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={handleRedeem}
                disabled={isRedeeming}
              >
                {isRedeeming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join D&D Sound Board
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={signInWithGoogle}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in with Google
              </Button>
            )
          ) : (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate("/playback")}
            >
              Go to Sound Board
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}