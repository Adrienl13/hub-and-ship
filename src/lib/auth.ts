// ============================================================
// Auth — wrapper Supabase Auth + hooks React
// ============================================================

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

export type Professional = Database["public"]["Tables"]["professionals"]["Row"];

export interface SignUpInput {
  email: string;
  password: string;
  companyName: string;
  contactName: string;
  phone: string;
  /** 14 chiffres, validé côté form */
  siret: string;
  deliveryZip?: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

export async function signUp(input: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        company_name: input.companyName,
        contact_name: input.contactName,
        phone: input.phone,
        siret: input.siret,
        delivery_zip: input.deliveryZip ?? null,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export interface UpdateProfileInput {
  companyName: string;
  contactName: string;
  phone: string;
  deliveryZip?: string | null;
}

/** Met à jour le profil pro courant. SIRET et email ne sont pas modifiables ici. */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const { error } = await supabase
    .from("professionals")
    .update({
      company_name: input.companyName,
      contact_name: input.contactName,
      phone: input.phone,
      delivery_zip: input.deliveryZip ?? null,
    })
    .eq("id", userId);
  if (error) throw error;
}

/** Envoie un email de réinitialisation de mot de passe. */
export async function requestPasswordReset(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      redirectTo ??
      (typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined),
  });
  if (error) throw error;
}

/** Définit un nouveau mot de passe (l'utilisateur doit être authentifié via le lien email). */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export function isValidSiret(siret: string): boolean {
  return /^[0-9]{14}$/.test(siret.replace(/\s+/g, ""));
}

// ----------------------------------------------------------------
// Query keys
// ----------------------------------------------------------------

export const authKeys = {
  session: ["auth", "session"] as const,
  professional: (userId: string | undefined) => ["auth", "professional", userId] as const,
};

// ----------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------

/** Session courante. Réagit aux signIn/signOut via onAuthStateChange. */
export function useSession() {
  const qc = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      qc.setQueryData(authKeys.session, session);
      // Refetch le profil pro
      qc.invalidateQueries({ queryKey: ["auth", "professional"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return useQuery<Session | null>({
    queryKey: authKeys.session,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    staleTime: Infinity,
  });
}

/** Profil pro associé à la session courante. */
export function useProfessional() {
  const sessionQuery = useSession();
  const userId = sessionQuery.data?.user.id;

  return useQuery<Professional | null>({
    queryKey: authKeys.professional(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function getUserDisplayName(
  user: User | null | undefined,
  pro: Professional | null | undefined,
): string {
  if (pro?.contact_name) return pro.contact_name;
  if (user?.email) return user.email;
  return "Mon compte";
}

export function getUserInitials(
  user: User | null | undefined,
  pro: Professional | null | undefined,
): string {
  const source = pro?.contact_name || pro?.company_name || user?.email || "?";
  const parts = source.trim().split(/[\s@.]+/);
  const letters = parts
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}
