import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, onAuthStateChanged, User } from './firebase';
import { apiRequest } from './queryClient';

// User context type
type UserContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAllowed: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
};

// Default context
const defaultContext: UserContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAllowed: false,
  isAdmin: false,
  logout: async () => {},
};

// Create context
const UserContext = createContext<UserContextType>(defaultContext);

// Hook for using the auth context
export const useAuth = () => useContext(UserContext);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if the user is allowed
  const checkUserAllowed = async (email: string) => {
    try {
      const response = await apiRequest({
        url: '/api/auth/check',
        method: 'POST',
        body: { email }
      });
      
      const data = response as { allowed: boolean; isAdmin: boolean };
      setIsAllowed(data.allowed);
      setIsAdmin(data.isAdmin);
      
      return data.allowed;
    } catch (error) {
      console.error('Error checking user allowlist:', error);
      setIsAllowed(false);
      setIsAdmin(false);
      return false;
    }
  };

  // Update user login time and UID
  const updateUserLogin = async (token: string, uid: string) => {
    try {
      await apiRequest({
        url: '/api/auth/update-login',
        method: 'POST',
        body: { uid },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error updating user login:', error);
    }
  };

  // Handle logout
  const logout = async () => {
    try {
      // Using the imported signOut function from firebase.ts
      await auth.signOut();
      setUser(null);
      setIdToken(null);
      setIsAuthenticated(false);
      setIsAllowed(false);
      setIsAdmin(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is signed in
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
          setUser(firebaseUser);
          
          // Check if user is allowed
          if (firebaseUser.email) {
            const allowed = await checkUserAllowed(firebaseUser.email);
            
            if (allowed) {
              // Update last login time
              await updateUserLogin(token, firebaseUser.uid);
              setIsAuthenticated(true);
            } else {
              // If not allowed, sign out
              await logout();
            }
          }
        } else {
          // User is signed out
          setUser(null);
          setIdToken(null);
          setIsAuthenticated(false);
          setIsAllowed(false);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setIsLoading(false);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Extend queryClient with auth token
  useEffect(() => {
    if (idToken) {
      // Add the token to all API requests
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        // Only add auth header to our API requests
        if (typeof input === 'string' && input.startsWith('/api')) {
          init = init || {};
          init.headers = {
            ...init.headers,
            Authorization: `Bearer ${idToken}`,
          };
        }
        return originalFetch(input, init);
      };

      return () => {
        // Restore original fetch
        window.fetch = originalFetch;
      };
    }
  }, [idToken]);

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isAllowed,
        isAdmin,
        logout
      }}
    >
      {children}
    </UserContext.Provider>
  );
}