import { useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["Catalogue", "/#catalogue"],
  ["Comment ça marche", "/#comment"],
  ["Containers livrés", "/livres"],
  ["FAQ", "/#faq"],
];

export function Header({ onReserve }: { onReserve?: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleReserve = () => {
    setMobileOpen(false);
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

        {/* Nav desktop */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(([label, href]) => (
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
            size="sm"
            onClick={handleReserve}
            className="hidden h-9 rounded-sm bg-foreground px-4 text-background hover:bg-foreground/90 sm:inline-flex"
          >
            Réserver
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-72 flex-col bg-[color:var(--sand)] p-0">
              <SheetHeader className="border-b border-[color:var(--sand-deep)] p-6 pb-4">
                <SheetTitle className="text-left font-display text-base font-semibold tracking-tight">
                  Container Club
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
                {NAV_LINKS.map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-sm px-3 py-3 text-base text-foreground/85 transition-colors hover:bg-[color:var(--sand-soft)] hover:text-foreground"
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="border-t border-[color:var(--sand-deep)] p-4">
                <Button
                  onClick={handleReserve}
                  className="h-10 w-full rounded-sm bg-foreground px-4 text-background hover:bg-foreground/90"
                >
                  Réserver
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
