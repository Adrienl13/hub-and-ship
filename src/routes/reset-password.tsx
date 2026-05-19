import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, useSession } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: "Réinitialiser le mot de passe — Container Club" }],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const sessionQuery = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase reset password : l'utilisateur est authentifié temporairement
  // après avoir cliqué sur le lien dans l'email. detectSessionInUrl=true
  // (cf. lib/supabase.ts) parse le hash automatiquement.
  const user = sessionQuery.data?.user;

  const canSubmit = password.length >= 8 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
      toast.success("Mot de passe mis à jour");
      setTimeout(() => navigate({ to: "/compte" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-md px-6 py-16">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour à l'accueil
        </a>

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          Nouveau mot de passe
        </h1>

        {sessionQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin" /> Vérification du lien…
          </p>
        ) : !user ? (
          <p className="mt-4 text-sm text-[color:var(--ember)]">
            Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.
          </p>
        ) : done ? (
          <div className="mt-6 rounded-md border border-[color:var(--forest)]/30 bg-[color:var(--forest)]/10 p-4 text-sm text-[color:var(--forest)]">
            <Check className="mr-1 inline h-4 w-4" />
            Mot de passe mis à jour. Redirection vers votre espace…
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Définissez un nouveau mot de passe pour <strong>{user.email}</strong>.
            </p>
            <div className="space-y-1">
              <Label htmlFor="pw" className="text-xs font-medium">
                Nouveau mot de passe (8 caractères min.)
              </Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw2" className="text-xs font-medium">
                Confirmer
              </Label>
              <Input
                id="pw2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-[10px] text-[color:var(--ember)]">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>
            {error && (
              <p className="text-xs text-[color:var(--ember)]" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={!canSubmit || loading}
              className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
