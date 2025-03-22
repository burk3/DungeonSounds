import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ValidateInviteCodeResponse } from "@shared/schema";

interface InvitePageProps {
  code: string;
}

export default function InvitePage({ code }: InvitePageProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isAllowed } = useAuth();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    // Check if the user is already authenticated and allowed
    if (isAuthenticated && isAllowed) {
      // User is already registered and allowed, redirect to remote
      toast({
        title: "Already registered",
        description: "You are already an allowed user. Redirecting to remote control.",
        variant: "default",
      });
      
      setTimeout(() => {
        navigate("/remote");
      }, 2000);
      
      return;
    }
    
    // Check if code is valid
    if (!code || code.length < 6) {
      setIsValid(false);
      setMessage("Invalid invite code format");
      setIsValidating(false);
      return;
    }
    
    // Validate the invite code
    async function validateCode() {
      try {
        setIsValidating(true);
        
        const response = await apiRequest<ValidateInviteCodeResponse>({
          url: `/api/invite/${code}/validate`,
          method: "GET",
        });
        
        setIsValid(response.valid);
        if (response.message) {
          setMessage(response.message);
        }
      } catch (error: any) {
        console.error("Error validating invite code:", error);
        setIsValid(false);
        setMessage(error?.message || "Failed to validate invite code. Please try again later.");
      } finally {
        setIsValidating(false);
      }
    }
    
    validateCode();
  }, [code, isAuthenticated, isAllowed, navigate, toast]);
  
  const handleRedeem = async () => {
    try {
      // Get user info from localStorage
      const email = window.localStorage.getItem('userEmail');
      const displayName = window.localStorage.getItem('userName');
      const uid = window.localStorage.getItem('userUid');
      
      // Check if we have necessary user data
      if (!email || !uid) {
        toast({
          title: "Error",
          description: "You need to sign in first to redeem this invite code.",
          variant: "destructive",
        });
        
        setTimeout(() => {
          navigate("/remote"); // Go to login page
        }, 2000);
        
        return;
      }
      
      setIsValidating(true);
      
      const response = await apiRequest({
        url: `/api/invite/${code}/redeem`,
        method: "POST",
        body: {
          email,
          displayName: displayName || '',
          uid
        }
      });
      
      toast({
        title: "Success!",
        description: "Your invite code has been redeemed. You now have access to the sound board.",
        variant: "default",
      });
      
      // Redirect to remote
      setTimeout(() => {
        navigate("/remote");
      }, 2000);
    } catch (error: any) {
      console.error("Error redeeming invite code:", error);
      const errorMessage = error?.message || "Failed to redeem invite code. Please try again later.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  return (
    <div className="bg-[#2A2523] min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-amber-500">D&D Sound Board Invite</CardTitle>
          <CardDescription>Join your D&D group's sound board with this exclusive invite</CardDescription>
        </CardHeader>
        
        <CardContent>
          {isValidating ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-4" />
              <p className="text-center">Validating your invite code...</p>
            </div>
          ) : isValid ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-green-500">
                <Check className="h-5 w-5" />
                <span className="font-medium">Valid invite code!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This invite code is valid and ready to use. Click the button below to redeem it and get access to the D&D Sound Board.
              </p>
              {isAuthenticated ? (
                <p className="text-sm text-amber-500">
                  You are already signed in. Click "Redeem Invite" to gain access to the sound board.
                </p>
              ) : (
                <p className="text-sm text-amber-500">
                  You will need to sign in with Google after redeeming this invite.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-red-500">
                <X className="h-5 w-5" />
                <span className="font-medium">Invalid invite code</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {message || "This invite code is invalid or has already been used."}
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            Go Home
          </Button>
          
          {isValid && !isValidating && (
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleRedeem}
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Redeem Invite"
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}