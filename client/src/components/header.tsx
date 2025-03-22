import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield } from "lucide-react";
import { Switch, Link } from "wouter";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Header() {
  const { user, logout, isAdmin } = useAuth();
  const [location] = useLocation();
  const isPlayback = location === "/playback";

  const getInitials = (name: string | null): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <header className="border-b border-amber-950 bg-gradient-to-r from-[#2A221F] to-[#352D2A] px-4 py-2 text-amber-100 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-amber-400">D&D Soundboard</h1>
          
          <nav className="hidden space-x-2 sm:flex">
            <Link href="/playback">
              <a className={`rounded-md px-3 py-1 ${isPlayback ? 'bg-amber-800 text-amber-100' : 'hover:bg-amber-900 hover:text-amber-200'}`}>
                Playback
              </a>
            </Link>
            <Link href="/remote">
              <a className={`rounded-md px-3 py-1 ${!isPlayback ? 'bg-amber-800 text-amber-100' : 'hover:bg-amber-900 hover:text-amber-200'}`}>
                Remote
              </a>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <div className="flex items-center text-amber-400">
              <Shield className="mr-1 h-4 w-4" />
              <span className="text-sm">Admin</span>
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full border border-amber-800 bg-amber-900/20">
                <Avatar className="h-8 w-8">
                  {user?.photoURL ? (
                    <AvatarImage src={user.photoURL} />
                  ) : null}
                  <AvatarFallback className="bg-amber-800 text-amber-100">
                    {getInitials(user?.displayName || null)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 border-amber-900 bg-[#32291F] text-amber-100" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-amber-300">{user?.displayName}</p>
                  <p className="text-xs leading-none text-amber-500">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-amber-900/50" />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-amber-400 focus:bg-amber-900 focus:text-amber-100"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="mt-2 flex sm:hidden">
        <nav className="flex w-full justify-center space-x-2">
          <Link href="/playback">
            <a className={`flex-1 rounded-md px-3 py-1 text-center ${isPlayback ? 'bg-amber-800 text-amber-100' : 'hover:bg-amber-900 hover:text-amber-200'}`}>
              Playback
            </a>
          </Link>
          <Link href="/remote">
            <a className={`flex-1 rounded-md px-3 py-1 text-center ${!isPlayback ? 'bg-amber-800 text-amber-100' : 'hover:bg-amber-900 hover:text-amber-200'}`}>
              Remote
            </a>
          </Link>
        </nav>
      </div>
    </header>
  );
}