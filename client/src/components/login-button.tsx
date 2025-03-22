import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface LoginButtonProps {
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export default function LoginButton({ variant = "default", className }: LoginButtonProps) {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <Button disabled variant={variant} className={className}>
        Loading...
      </Button>
    );
  }

  if (user) {
    return (
      <Button onClick={logout} variant={variant} className={className}>
        Logout ({user.name})
      </Button>
    );
  }

  return (
    <Button onClick={login} variant={variant} className={className}>
      Login with Replit
    </Button>
  );
}