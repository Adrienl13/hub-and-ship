import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, LayoutDashboard, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthDialog } from "@/components/AuthDialog";
import { getUserInitials, signOut, useProfessional, useSession } from "@/lib/auth";
import { toast } from "sonner";

export function Header({ onReserve }: { onReserve: () => void }) {
  const sessionQuery = useSession();
  const proQuery = useProfessional();
  const [authOpen, setAuthOpen] = useState(false);

  const user = sessionQuery.data?.user;
  const pro = proQuery.data;
  const initials = getUserInitials(user, pro);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Déconnecté");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[color:var(--sand-deep)] bg-[color:var(--sand)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-foreground font-display text-base font-semibold text-background">
            C
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Container Club
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            ["Catalogue", "#catalogue"],
            ["Comment ça marche", "#comment"],
            ["Containers livrés", "#livres"],
            ["FAQ", "#faq"],
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
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 rounded-sm text-foreground/85 hover:bg-[color:var(--sand-soft)]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                    {initials}
                  </span>
                  <span className="hidden sm:inline text-xs">
                    {pro?.company_name ?? "Mon compte"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pro && (
                  <DropdownMenuLabel className="text-xs">
                    {pro.company_name}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      SIRET {pro.siret}
                    </span>
                  </DropdownMenuLabel>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer text-xs">
                  <Link to="/compte">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Mes réservations
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-xs">
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthOpen(true)}
              className="hidden h-9 gap-1.5 text-foreground/75 hover:bg-[color:var(--sand-soft)] sm:inline-flex"
            >
              <User className="h-3.5 w-3.5" />
              Connexion
            </Button>
          )}
          <Button
            size="sm"
            onClick={onReserve}
            className="h-9 rounded-sm bg-foreground px-4 text-background hover:bg-foreground/90"
          >
            Réserver
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </header>
  );
}
