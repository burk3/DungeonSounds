import { useState } from "react";
import { useQuery, useMutation, QueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Clipboard, Check, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InviteCode, InviteResponsePayload } from "@shared/schema";

interface AdminPanelProps {
  queryClient: QueryClient;
}

export default function AdminPanel({ queryClient }: AdminPanelProps) {
  const { toast } = useToast();
  const [copying, setCopying] = useState<string | null>(null);

  // Fetch existing invite codes
  const { 
    data: inviteCodes = [], 
    isLoading: isLoadingCodes,
    isError: isErrorCodes,
    error: errorCodes,
    refetch: refetchInviteCodes
  } = useQuery<InviteCode[]>({
    queryKey: ['/api/admin/invite-codes'],
    refetchInterval: false,
  });

  // Create new invite code
  const { mutate: createInviteCode, isPending: isCreatingCode } = useMutation({
    mutationFn: async () => {
      return apiRequest<InviteResponsePayload>({
        url: '/api/admin/invite-codes',
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invite-codes'] });
      toast({
        title: "Invite code created",
        description: "New invite code has been generated successfully.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invite code.",
        variant: "destructive",
      });
    }
  });

  // Copy invite URL to clipboard
  const copyToClipboard = async (inviteUrl: string, code: string) => {
    try {
      setCopying(code);
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard.",
        variant: "default",
      });
      
      // Reset the copy state after 2 seconds
      setTimeout(() => setCopying(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy invite link.",
        variant: "destructive",
      });
      setCopying(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Loading state
  if (isLoadingCodes) {
    return (
      <Card className="w-full shadow">
        <CardHeader>
          <CardTitle className="text-lg text-amber-400">Invite Management</CardTitle>
          <CardDescription>Generate and manage invite codes</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isErrorCodes) {
    return (
      <Card className="w-full shadow">
        <CardHeader>
          <CardTitle className="text-lg text-amber-400">Invite Management</CardTitle>
          <CardDescription>Generate and manage invite codes</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">
            Error loading invite codes: {errorCodes instanceof Error ? errorCodes.message : 'Unknown error'}
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/invite-codes'] })}
          >
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Create a full invite URL 
  const getInviteUrl = (code: string) => {
    // Get the current origin (protocol + host)
    const origin = window.location.origin;
    return `${origin}/invite/${code}`;
  };

  return (
    <Card className="w-full shadow">
      <CardHeader>
        <CardTitle className="text-lg text-amber-400">Invite Management</CardTitle>
        <CardDescription>Generate and manage invite codes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={() => createInviteCode()}
            disabled={isCreatingCode}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isCreatingCode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Generate New Invite Code
              </>
            )}
          </Button>

          <Separator className="my-4" />
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Invite Codes</Label>
            
            {inviteCodes && inviteCodes.length > 0 ? (
              <div className="space-y-3">
                {inviteCodes.map((invite: InviteCode) => {
                  const inviteUrl = getInviteUrl(invite.code);
                  return (
                    <div 
                      key={invite.code}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{invite.code}</p>
                        <p className="text-xs text-muted-foreground">
                          Created by: {invite.createdBy}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created: {formatDate(invite.createdAt)}
                        </p>
                      </div>
                      <div className="flex mt-2 sm:mt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto flex-shrink-0"
                          onClick={() => copyToClipboard(inviteUrl, invite.code)}
                        >
                          {copying === invite.code ? (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Clipboard className="mr-1 h-4 w-4" />
                              Copy Link
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No active invite codes. Generate one to invite new users.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}