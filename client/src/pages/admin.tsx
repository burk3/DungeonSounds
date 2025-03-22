import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getQueryFn, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// Form validation schema
const emailSchema = z.string().email('Please enter a valid email address');

type User = {
  id: number;
  email: string;
  isAdmin: boolean;
  displayName: string | null;
  uid: string | null;
  lastLogin?: string | null;
};

export default function AdminPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Redirect unauthorized users
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      window.location.href = '/';
    }
  }, [isAuthenticated, isAdmin]);

  // Fetch users
  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ['/api/admin/allowed-users'],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: isAuthenticated && isAdmin
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (userData: { email: string; isAdmin: boolean }) => {
      return apiRequest({
        url: '/api/admin/add-user',
        method: 'POST',
        body: userData
      });
    },
    onSuccess: () => {
      toast({
        title: 'User Added',
        description: `${email} has been added to the allowed users list.`,
      });
      setEmail('');
      setIsAdminRole(false);
      refetch();
    },
    onError: (error: any) => {
      console.error('Add user error:', error);
      toast({
        title: 'Failed to add user',
        description: error?.message || 'There was an error adding the user.',
        variant: 'destructive',
      });
    }
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest({
        url: `/api/admin/remove-user/${encodeURIComponent(email)}`,
        method: 'DELETE'
      });
    },
    onSuccess: (_data, email) => {
      toast({
        title: 'User Removed',
        description: `${email} has been removed from the allowed users list.`,
      });
      refetch();
    },
    onError: (error: any) => {
      console.error('Remove user error:', error);
      toast({
        title: 'Failed to remove user',
        description: error?.message || 'There was an error removing the user.',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate email
      emailSchema.parse(email);
      setEmailError('');
      
      // Add user
      addUserMutation.mutate({ email, isAdmin: isAdminRole });
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0]?.message || 'Invalid email');
      }
    }
  };

  const handleRemoveUser = (email: string) => {
    if (confirm(`Are you sure you want to remove ${email}?`)) {
      removeUserMutation.mutate(email);
    }
  };

  if (!isAuthenticated) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!isAdmin) {
    return <div className="container mx-auto p-6">Access Denied: Admin privileges required</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add User Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Add User</CardTitle>
            <CardDescription>Add a new user to the allowed list</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className={emailError ? "border-red-500" : ""}
                  />
                  {emailError && (
                    <p className="text-red-500 text-sm mt-1">{emailError}</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={isAdminRole}
                    onChange={(e) => setIsAdminRole(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="isAdmin" className="text-sm font-medium">
                    Grant admin privileges
                  </label>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full mt-4"
                disabled={addUserMutation.isPending}
              >
                {addUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* User List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Allowed Users</CardTitle>
            <CardDescription>Users who can access the soundboard</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {users && users.length > 0 ? (
                  <div className="overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user: User) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.isAdmin ? "destructive" : "outline"}>
                                {user.isAdmin ? "Admin" : "User"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveUser(user.email)}
                                disabled={removeUserMutation.isPending}
                                title="Remove user"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    No users found. Add your first user above.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <Separator className="my-4" />
        <h2 className="text-lg font-medium mb-2">Notes:</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>Users need to be added to the allowed list before they can log in.</li>
          <li>Adding a user will not automatically notify them.</li>
          <li>Admin users can add/remove other users and delete sounds.</li>
          <li>Regular users can only upload and play sounds.</li>
        </ul>
      </div>
    </div>
  );
}