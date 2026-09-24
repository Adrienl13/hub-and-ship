// Fonction serveur « Relancer », appelée depuis le back-office.
//
// Ce fichier ne porte pas le suffixe `.server` : il est importé par les
// composants (le compilateur de TanStack Start remplace le handler par un
// appel réseau côté client et retire ses imports serveur). Tout le travail
// réel — vérification de l'admin, lecture de la cible, envoi Brevo, trace —
// vit dans follow-ups.server.ts, qui reste interdit au navigateur.

import { createServerFn } from '@tanstack/react-start'

import {
  followUpInputSchema,
  performAdminFollowUp,
  type SendAdminFollowUpInput,
  type SendAdminFollowUpResult,
} from './follow-ups.server'

export type { SendAdminFollowUpInput, SendAdminFollowUpResult }

export const sendAdminFollowUp = createServerFn({ method: 'POST' })
  .inputValidator(followUpInputSchema)
  .handler(async ({ data }) => performAdminFollowUp(data))
