import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Guide", href: "/guide" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Agents", href: "/for-agents" },
  { label: "API Docs", href: "/api-docs" },
];

const LandingNav = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => {
          const active = location.pathname === link.href;
          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-smooth hover:text-primary hover:bg-primary/5",
                active ? "text-primary" : "text-foreground/80"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile burger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-9 w-9"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile dropdown panel */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 border-b border-border bg-background/95 backdrop-blur-xl shadow-lg">
          <div className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "px-3 py-3 rounded-md text-base font-medium transition-smooth",
                    active
                      ? "text-primary bg-primary/10"
                      : "text-foreground/90 hover:bg-primary/5 hover:text-primary"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default LandingNav;
