import { Outlet, Link, useLocation } from "react-router-dom";
import { Shield, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
];

const Layout = () => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 glass">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground">
              Fraud<span className="text-gradient">Lens</span> AI
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-sm transition-colors",
                  location.pathname === link.to
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/submit"
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium transition-colors",
                location.pathname === "/submit"
                  ? "bg-primary/80 text-primary-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              New Claim
            </Link>
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
      <Outlet />
    </div>
  );
};

export default Layout;
