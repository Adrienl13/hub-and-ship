import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { StaticPageLayout } from "@/components/StaticPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  component: Contact,
  head: () => ({
    meta: [{ title: "Contact — Container Club" }],
  }),
});

function Contact() {
  return (
    <StaticPageLayout eyebrow="On répond vite" title="Nous contacter">
      <div className="grid gap-8 md:grid-cols-5">
        <ContactInfo />
        <ContactForm />
      </div>
    </StaticPageLayout>
  );
}

function ContactInfo() {
  return (
    <aside className="space-y-4 md:col-span-2">
      <div>
        <div className="label-eyebrow text-muted-foreground">Email</div>
        <a
          href="mailto:contact@container-club.fr"
          className="mt-1 inline-flex items-center gap-2 text-sm text-foreground hover:text-[color:var(--ember)]"
        >
          <Mail className="h-3.5 w-3.5" />
          contact@container-club.fr
        </a>
      </div>
      <div>
        <div className="label-eyebrow text-muted-foreground">Téléphone</div>
        <div className="mt-1 inline-flex items-center gap-2 text-sm text-foreground">
          <Phone className="h-3.5 w-3.5" />
          +33 [x xx xx xx xx]
        </div>
      </div>
      <div>
        <div className="label-eyebrow text-muted-foreground">Adresse</div>
        <div className="mt-1 flex items-start gap-2 text-sm text-foreground/80">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>[Adresse du siège]</span>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-4 text-xs text-foreground/80">
        <p className="font-medium text-foreground">Demande pro ?</p>
        <p className="mt-1">
          Pour un projet d'équipement complet, contactez-nous directement par email avec le volume
          estimé : on revient sous 24h ouvrées.
        </p>
      </div>
    </aside>
  );
}

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && email.includes("@") && message.trim().length > 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // TODO: brancher sur edge function /functions/v1/contact-email
      await new Promise((r) => setTimeout(r, 700));
      toast.success("Message envoyé", {
        description: "Nous revenons vers vous sous 24h ouvrées.",
      });
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur d'envoi";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 md:col-span-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom complet *" id="name" value={name} onChange={setName} />
        <Field label="Entreprise" id="company" value={company} onChange={setCompany} />
      </div>
      <Field label="Email *" id="email" type="email" value={email} onChange={setEmail} />
      <div className="space-y-1">
        <Label htmlFor="message" className="text-xs font-medium">
          Message *
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="rounded-none border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] focus-visible:border-foreground focus-visible:ring-0"
          placeholder="Décrivez votre projet, votre volume estimé, vos contraintes…"
        />
      </div>
      <Button
        type="submit"
        disabled={!canSubmit || submitting}
        className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Envoyer
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Vos données sont traitées conformément à notre politique de confidentialité.
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
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
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
        className="h-10 rounded-none border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] focus-visible:border-foreground focus-visible:ring-0"
      />
    </div>
  );
}
