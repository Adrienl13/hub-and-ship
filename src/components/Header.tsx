import { ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header({ onReserve }: { onReserve?: () => void }) {
  const handleReserve = () => {
    if (onReserve) {
      onReserve();
    } else if (typeof window !== "undefined") {
      // Pas de contexte de réservation sur cette page : on renvoie au catalogue.
      window.location.href = "/#catalogue";
    }
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[color:var(--sand-deep)] bg-[color:var(--sand)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <a href="/#top" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-foreground font-display text-base font-semibold text-background">
            C
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Container Club
          </span>
        </a>

        {/* Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {[
            ["Catalogue", "/#catalogue"],
            ["Comment ça marche", "/#comment"],
            ["Containers livrés", "/livres"],
            ["FAQ", "/#faq"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm text-foreground/75 transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-9 gap-1.5 text-foreground/75 hover:bg-[color:var(--sand-soft)] sm:inline-flex"
          >
            <User className="h-3.5 w-3.5" />
            Mon compte
          </Button>
          <Button
            size="sm"
            onClick={handleReserve}
            className="h-9 rounded-sm bg-foreground px-4 text-background hover:bg-foreground/90"
          >
            Réserver
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
