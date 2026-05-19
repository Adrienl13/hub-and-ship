import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuthDialog } from "./AuthDialog";

describe("<AuthDialog />", () => {
  it("renders the connection tab by default", () => {
    render(<AuthDialog open onOpenChange={() => {}} />);
    expect(screen.getByText("Connexion pro")).toBeInTheDocument();
  });

  it("renders signin form fields", () => {
    render(<AuthDialog open onOpenChange={() => {}} />);
    expect(screen.getByLabelText(/Email pro/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument();
  });

  it("has a 'forgot password' affordance on signin", () => {
    render(<AuthDialog open onOpenChange={() => {}} />);
    expect(screen.getByText(/Mot de passe oublié/i)).toBeInTheDocument();
  });

  it("toggles to reset-password mode", () => {
    render(<AuthDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText(/Mot de passe oublié/i));
    expect(screen.getByText(/Envoyer le lien de réinitialisation/i)).toBeInTheDocument();
    // Le champ password disparaît
    expect(screen.queryByLabelText(/Mot de passe$/)).not.toBeInTheDocument();
  });

  it("renders signup tab when default is signup", () => {
    render(<AuthDialog open onOpenChange={() => {}} defaultTab="signup" />);
    expect(screen.getByText("Créer un compte pro")).toBeInTheDocument();
    expect(screen.getByLabelText(/Société/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SIRET/)).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(<AuthDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Connexion pro")).not.toBeInTheDocument();
  });

  it("submit button on signup is disabled with empty form", () => {
    render(<AuthDialog open onOpenChange={() => {}} defaultTab="signup" />);
    const btn = screen.getByRole("button", { name: /Créer mon compte pro/i });
    expect(btn).toBeDisabled();
  });

  it("displays SIRET format error when invalid", () => {
    render(<AuthDialog open onOpenChange={() => {}} defaultTab="signup" />);
    const siret = screen.getByLabelText(/SIRET/) as HTMLInputElement;
    fireEvent.change(siret, { target: { value: "12345" } });
    expect(screen.getByText(/Format SIRET invalide/i)).toBeInTheDocument();
  });
});
