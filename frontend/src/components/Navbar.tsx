import { Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, Sun, Moon, LogOut, User, LayoutDashboard, FileText, Plus } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  rightContent?: React.ReactNode;
}

const Navbar = ({ rightContent }: NavbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground">
            Fraud<span className="text-gradient">Lens</span> AI
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {/* Navigation Links */}
          {currentUser && (
            <div className="hidden sm:flex items-center gap-4">
              {isAdmin ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`text-sm transition-colors ${location.pathname === "/dashboard"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <span className="flex items-center gap-1">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/my-claims"
                    className={`text-sm transition-colors ${location.pathname === "/my-claims"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" /> My Claims
                    </span>
                  </Link>
                  <Link
                    to="/submit"
                    className={`text-sm transition-colors ${location.pathname === "/submit"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <span className="flex items-center gap-1">
                      <Plus className="h-4 w-4" /> Submit Claim
                    </span>
                  </Link>
                </>
              )}
            </div>
          )}

          {rightContent}

          {/* User Menu or Login Button */}
          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {userProfile?.displayName || userProfile?.email?.split("@")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{userProfile?.displayName}</span>
                    <span className="text-xs text-muted-foreground font-normal">{userProfile?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin ? (
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/my-claims")}>
                      <FileText className="mr-2 h-4 w-4" /> My Claims
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/submit")}>
                      <Plus className="mr-2 h-4 w-4" /> Submit Claim
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            location.pathname !== "/login" && location.pathname !== "/register" && (
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
            )
          )}

          <button
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
