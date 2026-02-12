import { Link, useLocation } from "react-router-dom";
import { Shield, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

interface NavbarProps {
  rightContent?: React.ReactNode;
}

const Navbar = ({ rightContent }: NavbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

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
          {location.pathname !== "/" && (
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
          )}
          {rightContent}
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
