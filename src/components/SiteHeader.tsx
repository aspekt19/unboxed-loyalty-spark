import { Link } from "react-router-dom";
import LandingNav from "@/components/landing/LandingNav";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Shared top header for inner pages (pricing, guide, api-docs, legal, etc.).
 * Logo is a link back to the home page so users always have a way out.
 */
const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-between items-center relative">
        <Link
          to="/"
          aria-label="Loyal Spark — back to home"
          className="flex items-center gap-2 sm:gap-2.5 group shrink-0"
        >
          <img
            src="/logo-icon.png"
            alt="Loyal Spark"
            className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg transition-smooth group-hover:scale-110 group-hover:rotate-6"
          />
          <span className="text-base sm:text-xl font-bold text-foreground tracking-tight">
            Loyal Spark
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <LandingNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
