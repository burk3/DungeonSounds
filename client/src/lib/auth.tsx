import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiRequest } from './queryClient';

// Define user type based on Replit Auth
type User = {
  id?: string;
  name?: string;
  bio?: string;
  url?: string;
  profileImage?: string;
  roles?: string[];
  teams?: string[];
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/auth/user');
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError(err instanceof Error ? err : new Error('Authentication check failed'));
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = () => {
    // Redirect to Replit login
    const redirectUrl = window.location.pathname;
    window.location.href = `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = () => {
    // Redirect to logout endpoint
    const redirectUrl = window.location.pathname;
    window.location.href = `/auth/logout?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}