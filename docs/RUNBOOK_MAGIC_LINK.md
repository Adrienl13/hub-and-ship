# Runbook — connexion par lien magique

Le lien magique est le **seul** mode de connexion du site : aucun mot de passe
n'existe. Tout ce qui le casse coupe l'accès à l'espace client, aux
réservations, aux factures et à l'espace partenaire.

## Les trois échecs courants

| Situation                                              | Ce que renvoie Supabase                                                                       | Ce que voit le client                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Lien expiré (> 1 h) ou déjà cliqué                     | `error=access_denied`, `error_code=otp_expired`, en query **ou** en fragment selon la version | « Ce lien a expiré. » + bouton « Recevoir un nouveau lien »  |
| Lien demandé sur l'ordinateur, ouvert sur le téléphone | **rien** — l'échange PKCE reste en suspens, faute de `code_verifier` dans ce navigateur       | Après 10 s : « Ce lien a été ouvert sur un autre appareil. » |
| Lien tronqué par le client mail                        | rien d'exploitable                                                                            | Après 10 s : « La connexion n'a pas abouti. »                |

Avant le 17 septembre 2026, aucun de ces cas n'était traité : la page restait
indéfiniment sur « Validation du lien magique », sans message ni bouton.

Le code vit dans `src/lib/auth/magic-link-callback.ts` (lecture de l'URL, pure
et testée) et `src/routes/auth.callback.tsx` (affichage et délai de garde).

## Régler le cas multi-appareil pour de bon

Le flux PKCE impose que le lien s'ouvre dans le navigateur qui l'a demandé.
En CHR, « je demande sur le PC du bureau et je lis mes mails sur mon
téléphone » est le cas **normal**, pas l'exception.

La sortie est un lien `token_hash`, qui se vérifie sans `code_verifier`.
Le code l'accepte déjà (`verifyMagicLinkToken`) ; il reste **une modification
à faire dans le tableau de bord Supabase**, elle ne peut pas être versionnée :

1. Dashboard → Authentication → Emails → modèle **Magic Link**.
2. Remplacer le lien par :

   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">
     Me connecter
   </a>
   ```

3. Vérifier que `Site URL` et les `Redirect URLs` autorisent
   `https://prosimport.com/auth/callback`.

`{{ .RedirectTo }}` porte déjà `?returnTo=…` : `signInWithMagicLink` l'ajoute
**systématiquement**, même à sa valeur par défaut, précisément pour que la
concaténation `&token_hash=` reste valide. Ne pas retirer ce paramètre.

## Recette

À faire en production, sur le domaine réel — le flux ne peut pas être vérifié
en local, les liens Supabase pointent sur l'origine du navigateur demandeur.

- [ ] Demander un lien, l'ouvrir **sur le même appareil** → session ouverte,
      redirection vers `returnTo`.
- [ ] Demander un lien, l'ouvrir **sur un autre appareil** → session ouverte
      une fois le modèle `token_hash` en place ; message explicite sinon.
- [ ] Cliquer **deux fois** le même lien → « Ce lien a expiré. », bouton
      « Recevoir un nouveau lien » qui conserve la destination.
- [ ] Attendre plus d'une heure, puis cliquer → même écran.
- [ ] Ouvrir `/auth/callback` sans aucun paramètre → message après 10 s, pas
      de spinner infini.
- [ ] Demander 6 liens d'affilée → le garde-fou de fréquence
      (`MAGIC_LINK_RATE_LIMIT`) répond « Trop de demandes ».
