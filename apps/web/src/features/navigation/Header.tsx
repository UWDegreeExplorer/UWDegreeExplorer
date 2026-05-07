import { useLocation } from "wouter";
import { useGetCurrentUser, useLogoutUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Settings, Menu } from "lucide-react";
import { type SectionFilter } from "@/lib/constants";

export function Header({ onMenuClick, showMenuButton, onSelectSection }: { onMenuClick?: () => void, showMenuButton?: boolean, onSelectSection: (s: SectionFilter) => void }) {
  const [, setLocation] = useLocation();
  const { data: userData } = useGetCurrentUser();
  const logout = useLogoutUser();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/");
      },
    });
  };

  const user = userData?.user;

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-50">
      <div className="flex items-center gap-4">
        {showMenuButton && (
          <Button variant="ghost" size="icon" className="lg:hidden -ml-2" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => setLocation("/")}
        >
        <img 
          src="/logo.png" 
          alt="UW Degree Explorer Logo" 
          className="h-8 object-contain group-hover:scale-105 transition-transform" 
        />
      </div>
    </div>

      <div className="flex items-center gap-4">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2.5 px-2 hover:bg-accent/50 transition-colors"
              >
                {(user as any).avatarUrl ? (
                  <img
                    src={(user as any).avatarUrl}
                    alt={user.displayName}
                    className="w-7 h-7 rounded-full object-cover border border-primary/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold border border-primary/20">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold leading-none">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {user.isAdmin ? "Administrator" : "Student Member"}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSelectSection("settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
            >
              Sign In
            </Button>
            <Button size="sm" onClick={() => setLocation("/register")}>
              Join Community
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}