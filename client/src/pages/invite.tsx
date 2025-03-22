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
    
    // Validate the invite code
    async function validateCode() {
      try {
        setIsValidating(true);
        
        const response = await apiRequest<ValidateInviteCodeResponse>({
          url: `/api/invite/validate/${code}`,
          method: "GET",
        });
        
        setIsValid(response.valid);
        if (response.message) {
          setMessage(response.message);
        }
      } catch (error) {
        console.error("Error validating invite code:", error);
        setIsValid(false);
        setMessage("Failed to validate invite code. Please try again later.");
      } finally {
        setIsValidating(false);
      }
    }
    
    validateCode();
  }, [code, isAuthenticated, isAllowed, navigate, toast]);
  
  const handleRedeem = async () => {
    try {
      setIsValidating(true);
      
      await apiRequest({
        url: `/api/invite/redeem/${code}`,
        method: "POST",
      });
      
      toast({
        title: "Success!",
        description: "Your invite code has been redeemed. Please log in to continue.",
        variant: "default",
      });
      
      // Redirect to remote (login)
      setTimeout(() => {
        navigate("/remote");
      }, 2000);
    } catch (error) {
      console.error("Error redeeming invite code:", error);
      toast({
        title: "Error",
        description: "Failed to redeem invite code. Please try again later.",
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