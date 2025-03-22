import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const [location] = useLocation();
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div className="bg-black/40 p-4 flex justify-between items-center">
      <div className="text-xl font-bold text-amber-500">D&D Soundboard</div>
      
      <div className="flex gap-4 items-center">
        <nav className="flex gap-2">
          <Link href="/playback">
            <Button 
              variant={location === '/playback' ? 'default' : 'ghost'}
              className={location === '/playback' ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-400 hover:text-amber-300'}
            >
              Playback
            </Button>
          </Link>
          <Link href="/remote">
            <Button 
              variant={location === '/remote' ? 'default' : 'ghost'}
              className={location === '/remote' ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-400 hover:text-amber-300'}
            >
              Remote
            </Button>
          </Link>
        </nav>
        
        {isLoading ? (
          <Button disabled className="ml-4">
            Loading...
          </Button>
        ) : user ? (
          <div className="flex items-center gap-2">
            <span className="text-amber-300 hidden sm:inline">
              {user.name || 'User'}
            </span>
            <Button 
              onClick={logout} 
              variant="outline"
              className="border-amber-700 text-amber-300 hover:bg-amber-900/50"
            >
              Logout
            </Button>
          </div>
        ) : (
          <Button 
            onClick={login} 
            className="ml-4 bg-amber-600 hover:bg-amber-700"
          >
            Login with Replit
          </Button>
        )}
      </div>
    </div>
  );
}