import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldOff } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/AuthDialog";
import { useIsAdmin } from "@/lib/admin";
import { useSession } from "@/lib/auth";

/**
 * Wrapper qui n'affiche children que si l'utilisateur courant est admin.
 * Affiche un fallback de connexion ou un refus selon le cas.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const sessionQuery = useSession();
  const { isAdmin, isLoading } = useIsAdmin();
  const [authOpen, setAuthOpen] = useState(false);

  const user = sessionQuery.data?.user;

  if (sessionQuery.isLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Espace administrateur
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connectez-vous avec un compte administrateur pour accéder à cette page.
          </p>
          <Button
            onClick={() => setAuthOpen(true)}
            className="mt-6 h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
          >
            Se connecter
          </Button>
          <Link
            to="/"
            className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            Retour à l'accueil
          </Link>
        </main>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-[color:var(--ember)]" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Accès refusé</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre compte n'a pas les droits d'administration. Si vous pensez que c'est une erreur,
            contactez le support.
          </p>
          <Link
            to="/compte"
            className="mt-6 inline-flex items-center justify-center rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Mon espace pro
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return <>{children}</>;
}
