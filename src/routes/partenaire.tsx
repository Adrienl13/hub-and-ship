// L'espace partenaire canonique est /partner (audit M5 : deux espaces
// concurrents avec des gates incompatibles — /partenaire était mort pour tous
// les utilisateurs car son gate dépendait de la chaîne société/canal cassée).
// Le contenu unique (QR apporteur, commissions, grille revendeur, récap grand
// compte) vit désormais dans /partner ; cette URL redirige pour ne casser
// aucun lien existant (footer historique, emails, favoris).

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/partenaire')({
  beforeLoad: () => {
    throw redirect({ to: '/partner' })
  },
})
