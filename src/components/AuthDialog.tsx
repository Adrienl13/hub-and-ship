import { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp, isValidSiret } from "@/lib/auth";

type Tab = "signin" | "signup";

export function AuthDialog({
  open,
  onOpenChange,
  defaultTab = "signin",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[color:var(--sand-soft)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            {tab === "signin" ? "Connexion pro" : "Créer un compte pro"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Container Club est réservé aux professionnels (CHR, revendeurs).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-2 rounded-sm bg-[color:var(--sand-deep)]/40">
            <TabsTrigger value="signin" className="rounded-sm text-xs">
              <LogIn className="mr-1.5 h-3 w-3" /> Connexion
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-sm text-xs">
              <UserPlus className="mr-1.5 h-3 w-3" /> Créer un compte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <SignInForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <SignUpForm
              onSuccess={() => {
                setTab("signin");
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      toast.success("Connecté");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de connexion";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field
        label="Email pro"
        id="signin-email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label="Mot de passe"
        id="signin-password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
      />
      {error && (
        <p className="text-xs text-[color:var(--ember)]" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Se connecter
      </Button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [siret, setSiret] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siretClean = siret.replace(/\s+/g, "");
  const siretOk = !siretClean || isValidSiret(siretClean);

  const canSubmit =
    email.includes("@") &&
    password.length >= 8 &&
    companyName.trim().length > 0 &&
    contactName.trim().length > 0 &&
    phone.length >= 6 &&
    isValidSiret(siretClean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await signUp({
        email,
        password,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone,
        siret: siretClean,
        deliveryZip: deliveryZip.trim() || undefined,
      });
      toast.success("Compte créé", {
        description: "Vérifiez votre email si une confirmation est demandée, puis connectez-vous.",
      });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de l'inscription";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Société *"
          id="signup-company"
          value={companyName}
          onChange={setCompanyName}
          required
        />
        <Field
          label="Nom du contact *"
          id="signup-contact"
          value={contactName}
          onChange={setContactName}
          required
        />
        <Field
          label="Email pro *"
          id="signup-email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Téléphone *"
          id="signup-phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          required
        />
        <Field
          label="SIRET (14 chiffres) *"
          id="signup-siret"
          value={siret}
          onChange={setSiret}
          inputMode="numeric"
          maxLength={17}
          error={!siretOk ? "Format SIRET invalide" : undefined}
          required
        />
        <Field
          label="Code postal livraison"
          id="signup-zip"
          value={deliveryZip}
          onChange={setDeliveryZip}
          inputMode="numeric"
        />
      </div>
      <Field
        label="Mot de passe (8 caractères min.) *"
        id="signup-password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
      />
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
        Créer mon compte pro
      </Button>
      <p className="text-[10px] text-muted-foreground">
        En créant un compte vous acceptez les CGU et la politique de confidentialité de Container
        Club.
      </p>
    </form>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
  inputMode,
  maxLength,
  error,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
      />
      {error && <p className="text-[10px] text-[color:var(--ember)]">{error}</p>}
    </div>
  );
}
