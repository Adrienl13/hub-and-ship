# Runbook — connexion par lien magique

Le lien magique est le **seul** mode de connexion du site : aucun mot de passe
n'existe. Tout ce qui le casse coupe l'accès à l'espace client, aux
réservations, aux factures et à l'espace partenaire.

Depuis le 23 septembre 2026, l'email de connexion n'est plus rédigé ni envoyé
par Supabase : Supabase appelle notre Worker (hook « Send Email »), qui
construit le lien et l'expédie via Brevo, aux couleurs de Terrassea.

## 1. Ce qui s'est passé le 23/09/2026

Lu dans les logs de production Supabase, 09:58 UTC :

- Un nouveau visiteur (`adrien.laniez@icloud.com`) a demandé un lien sur
  terrassea.com. Supabase a envoyé un email de type « confirmation » (modèle
  **Confirm signup**, pas **Magic Link**) depuis `noreply@mail.app.supabase.io`
  : mailer intégré, sans marque, plafonné à **2 emails par heure**.
- Le lien contenait `redirect_to=https://prosimport.com` : la Site URL Supabase
  était encore prosimport.com et `https://terrassea.com/auth/callback` n'était
  pas dans la liste des Redirect URLs. GoTrue a donc **remplacé** notre
  redirection par la Site URL. Après `/verify` (303), l'utilisateur est retombé
  sur la page d'accueil, **sans session** : le code PKCE n'a jamais été échangé
  (page vanilla, et lien ouvert sur iPhone alors qu'il avait été demandé sur
  Mac).
- Résultat : email confirmé, aucune session, aucune création d'espace.

Trois causes indépendantes, une seule sortie : reprendre la main sur l'email.

## 2. Comment ça marche maintenant

```
navigateur ── signInWithOtp({ email, emailRedirectTo: …/auth/callback?returnTo=… })
     │
     ▼
Supabase Auth ── génère token / token_hash, puis appelle le hook « Send Email »
     │              POST https://terrassea.com/api/auth/send-email
     │              en-têtes webhook-id / webhook-timestamp / webhook-signature
     ▼
Worker Terrassea (src/routes/api/auth/send-email.ts)
     │   1. vérifie la signature Standard Webhooks (src/lib/auth/send-email-hook.ts)
     │   2. construit LUI-MÊME le lien :
     │      https://terrassea.com/auth/callback?returnTo=…&token_hash=…&type=<action>
     │      (origine fixe : ni la Site URL ni la liste blanche n'interviennent)
     │   3. rédige l'email de marque (src/lib/email/templates.ts → buildAuthEmail)
     │   4. l'envoie via Brevo (src/lib/email/server.ts → sendEmail)
     │   5. répond 200 {} — ou une erreur, et Supabase fait échouer signInWithOtp
     ▼
Brevo ── email « Bienvenue chez Terrassea » (nouvelle adresse) ou
         « Votre lien de connexion » (adresse connue), expéditeur Terrassea
     │
     ▼
clic, sur N'IMPORTE QUEL appareil ── /auth/callback lit token_hash + type
     │                                 (src/lib/auth/magic-link-callback.ts)
     ▼
supabase.auth.verifyOtp({ token_hash, type }) ── session ouverte, sans code_verifier
     │
     ├── profil incomplet ──▶ /account/bienvenue (prénom, nom, établissement,
     │                          téléphone) puis tableau de bord
     └── profil complet  ──▶ returnTo (défaut /account)
```

Ce que cela change :

- **Multi-appareil** : le lien porte un `token_hash`, vérifiable partout. Le
  flux PKCE (qui exigeait le navigateur demandeur) n'est plus sur le chemin.
- **Marque et délivrabilité** : expéditeur Brevo, gabarit du site, version
  texte complète, lien en clair sous le bouton.
- **Indépendance du dashboard** : la Site URL et les Redirect URLs Supabase ne
  peuvent plus dérouter le lien. Elles restent à corriger (section 3e) pour
  les autres flux et par propreté, mais un oubli ne casse plus la connexion.
- **Pas de faux succès** : si l'email ne part pas, le hook répond une erreur,
  Supabase fait échouer `signInWithOtp` et la page de connexion affiche
  « Connexion indisponible ». Jamais de « Email envoyé » sans email.

Ce que le hook ne fait pas, volontairement :

- pas de contrôle d'origine ni de limite par IP : Supabase n'envoie pas
  d'en-tête `Origin` et ses adresses varient ; la signature est la seule porte
  (secret partagé, horodatage ±5 minutes, comparaison à temps constant) ;
- une seule tentative Brevo par email : Supabase laisse 5 secondes au hook ;
- aucun token, token_hash ni lien complet dans les logs : seulement le type,
  le destinataire et la raison d'un échec.

## 3. Réglages Supabase à faire UNE FOIS (Adrien), dans l'ordre

Aucun de ces réglages n'est versionnable : ils vivent dans le dashboard
Supabase et dans les secrets du Worker. **L'ordre compte** : le code doit
répondre avant que Supabase l'appelle, et le secret doit être posé côté Worker
avant que le hook soit activé. Sinon, plus aucun email de connexion ne part
(404 tant que l'URL n'est pas déployée, 503 tant que le secret manque).

### (a) Déployer le code

Sur le Mac, dans le dossier du projet, sur `main` à jour :

```sh
git pull && bun run deploy
```

Vérification : `https://terrassea.com/api/auth/send-email` répond **405** en
GET et **503** en POST (secret absent). `bun run security:portals` le confirme.

### (b) Générer le secret, sans activer le hook

Dashboard → **Authentication → Hooks** → **Send Email** :

1. Type : **HTTPS**.
2. URL : `https://terrassea.com/api/auth/send-email`.
3. **Generate secret** → copier le secret, de la forme `v1,whsec_…`.
   Il ne sera plus affiché en clair ensuite.
4. Laisser **Enable hook** décoché pour l'instant, et enregistrer.

### (c) Poser le secret côté Worker

Toujours sur le Mac, dans le dossier du projet :

```sh
wrangler secret put SUPABASE_SEND_EMAIL_HOOK_SECRET
# coller le secret « v1,whsec_… » puis Entrée
```

Un secret ne demande **aucun redéploiement** : il est disponible à la requête
suivante. En local, le poser dans `.dev.vars`, jamais dans une variable
`VITE_*`.

Vérification : le POST non signé répond maintenant **401** (plus 503).

### (d) Activer le hook

Retour dans Dashboard → **Authentication → Hooks** → **Send Email** : cocher
**Enable hook**, enregistrer. À partir de là, chaque demande de lien passe par
le Worker et l'email part de Brevo, aux couleurs de Terrassea.

### (e) Corriger les URL

Dashboard → **Authentication → URL Configuration** :

- **Site URL** : `https://terrassea.com`
- **Redirect URLs** :
  - `https://terrassea.com/**`
  - `https://www.terrassea.com/**`
  - `http://localhost:5173/**`

Le hook n'en dépend plus, mais `redirect_to` porte le `returnTo` (la page où
renvoyer après connexion) : si l'URL de rappel n'est pas autorisée, Supabase la
remplace par la Site URL, le `returnTo` est perdu et le client retombe sur le
tableau de bord au lieu de la page qu'il visait.

### (f) Relever la limite d'envoi

Dashboard → **Authentication → Rate Limits** → **Rate limit for sending
emails** :

- Vérifier la valeur : le mailer intégré était à **2 par heure**, ce qui
  bloque deux clients d'affilée.
- La monter à **30 par heure** si le champ est modifiable.
- **S'il est grisé**, c'est que Supabase impose d'abord un SMTP personnalisé
  (Authentication → Emails → SMTP Settings). Renseigner Brevo :
  - hôte `smtp-relay.brevo.com`, port `587` ;
  - identifiant = l'email du compte Brevo ;
  - mot de passe = une **clé SMTP** Brevo (pas la clé API) ;
  - expéditeur identique à `BREVO_FROM`.

  Le hook garde la main sur l'envoi : ce SMTP ne sert qu'à débloquer le
  champ de limite. Supabase ne l'utilisera que si le hook est désactivé.

### (g) Facultatif : les modèles d'email

Dashboard → **Authentication → Emails** → modèles (Confirm signup, Magic Link,
Change Email Address…) : ils ne sont **plus utilisés** une fois le hook actif.
Les laisser tels quels : ils redeviennent le repli si le hook est désactivé.

## 4. Mise en service et retour arrière

L'ordre sûr est celui de la section 3 : **déployer → générer le secret →
poser le secret → activer le hook → tester** (section 5).

En cas de problème : **désactiver le hook** dans le dashboard (Authentication →
Hooks → Send Email → Disable) rétablit immédiatement l'envoi par Supabase,
avec ses modèles et son mailer. Aucun déploiement à faire.

### Test manuel en curl (sans passer par Supabase)

`signStandardWebhook` (exporté par `src/lib/auth/send-email-hook.ts`) produit
la signature attendue. Avec un secret de **test** (jamais le secret réel dans
un terminal partagé) :

```ts
// bun run scripts/tmp-sign.ts  — script jetable, à ne pas committer
import {
  parseHookSecret,
  signStandardWebhook,
} from './src/lib/auth/send-email-hook'

const secret = parseHookSecret(process.env.HOOK_SECRET)!
const id = 'msg_test'
const timestamp = Math.floor(Date.now() / 1000)
const body = JSON.stringify({
  user: {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'vous@example.com',
  },
  email_data: {
    email_action_type: 'magiclink',
    token_hash: 'jeton_de_test',
    redirect_to: 'https://terrassea.com/auth/callback?returnTo=%2Faccount',
  },
})
const signature = await signStandardWebhook({ id, timestamp, body, secret })
console.log(
  `curl -sS -X POST https://terrassea.com/api/auth/send-email \\
  -H 'content-type: application/json' \\
  -H 'webhook-id: ${id}' -H 'webhook-timestamp: ${timestamp}' \\
  -H 'webhook-signature: ${signature}' \\
  --data '${body}'`,
)
```

Un lien avec `token_hash=jeton_de_test` ne se vérifiera pas (« Ce lien a
expiré »), mais l'email arrive : c'est le gabarit et l'acheminement Brevo que
l'on teste ici. Le secret de test doit être celui posé côté Worker, donc ce
test se fait **avant** d'activer le hook, ou sur un déploiement de preview.

## 5. Recette

À faire en production, sur le domaine réel.

- [ ] **Première visite** avec une adresse inconnue → email « Bienvenue chez
      Terrassea — créez votre espace », expéditeur Terrassea (pas
      `noreply@mail.app.supabase.io`) → clic **sur un autre appareil** que
      celui qui a demandé → `/account/bienvenue` → fiche (prénom, nom,
      établissement, téléphone) → `/account`.
- [ ] **Adresse connue** → email « Votre lien de connexion Terrassea » → clic
      → `/account` (ou la page `returnTo` demandée).
- [ ] Même lien cliqué **deux fois** → « Ce lien a expiré. », bouton
      « Recevoir un nouveau lien » qui conserve la destination.
- [ ] `GET https://terrassea.com/api/auth/send-email` → 405.
- [ ] `POST` non signé sur la même URL → 401 (503 tant que le secret n'est pas
      posé).
- [ ] `bun run security:portals` : les deux lignes `/api/auth/send-email`
      passent.
- [ ] Ouvrir `/auth/callback` sans aucun paramètre → message après 10 s, pas
      de spinner infini.
- [ ] Demander 6 liens d'affilée → le garde-fou de fréquence
      (`MAGIC_LINK_RATE_LIMIT`) répond « Trop de demandes ».

## 6. Dépannage

| Symptôme                                                          | Cause probable                                                                            | Geste                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email jamais reçu, page de connexion : « Connexion indisponible » | Hook actif mais secret absent côté Worker (503), ou URL du hook non déployée (404)        | Dashboard → Authentication → **Auth logs**, chercher « hook » dans le message ; `wrangler tail` sur le Worker. Poser le secret (3c) ou déployer (3a). En attendant : désactiver le hook. |
| Email reçu **depuis Supabase** (`noreply@mail.app.supabase.io`)   | Hook non activé, ou désactivé après un incident                                           | Authentication → Hooks → Send Email → Enable (3d).                                                                                                                                       |
| Clic → page d'accueil, pas de session                             | Ancien email, envoyé **avant** l'activation du hook (lien `redirect_to` vers la Site URL) | Redemander un lien ; corriger la Site URL et les Redirect URLs (3e).                                                                                                                     |
| Expéditeur en `@prosimport.com`                                   | `BREVO_FROM` toujours sur prosimport.com                                                  | Attendu tant que terrassea.com n'est pas vérifié DKIM chez Brevo. Basculer `BREVO_FROM` sur `contact@terrassea.com` **après** vérification (RUNBOOK_REBRANDING_TERRASSEA.md).            |
| « Connexion indisponible » et Auth logs : `email_not_sent`        | Brevo a refusé (clé invalide, expéditeur non vérifié, quota)                              | `wrangler tail` : la ligne `send-email hook: email non envoyé` porte la raison (`brevo_401`, `brevo_400`…). Vérifier `BREVO_API_KEY` et le domaine expéditeur dans Brevo.                |
| « Connexion indisponible » et Auth logs : `invalid_signature`     | Secret différent entre le dashboard et le Worker (secret régénéré, copie tronquée)        | Régénérer dans le dashboard puis reposer le secret (3b, 3c). Un décalage d'horloge > 5 min donnerait `stale_timestamp`.                                                                  |
| Deuxième client dans l'heure : aucun email                        | Limite d'envoi Supabase à 2/heure (mailer intégré)                                        | Relever la limite (3f). La limite s'applique **avant** le hook.                                                                                                                          |

### Les trois échecs à l'ouverture du lien

Ces cas sont traités par `/auth/callback` et restent valables :

| Situation                                              | Ce que renvoie Supabase                                                                       | Ce que voit le client                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Lien expiré (> 1 h) ou déjà cliqué                     | `error=access_denied`, `error_code=otp_expired`, en query **ou** en fragment selon la version | « Ce lien a expiré. » + bouton « Recevoir un nouveau lien »  |
| Lien demandé sur l'ordinateur, ouvert sur le téléphone | **rien** — l'échange PKCE reste en suspens, faute de `code_verifier` dans ce navigateur       | Après 10 s : « Ce lien a été ouvert sur un autre appareil. » |
| Lien tronqué par le client mail                        | rien d'exploitable                                                                            | Après 10 s : « La connexion n'a pas abouti. »                |

Le deuxième cas ne se produit plus avec les liens du hook (`token_hash`), mais
le message reste pour un ancien lien PKCE encore en circulation. Avant le
17 septembre 2026, aucun de ces cas n'était traité : la page restait
indéfiniment sur « Validation du lien magique », sans message ni bouton.

Le code vit dans `src/lib/auth/magic-link-callback.ts` (lecture de l'URL, pure
et testée) et `src/routes/auth.callback.tsx` (affichage et délai de garde) ;
le hook dans `src/lib/auth/send-email-hook.ts` (signature, lecture du corps,
plan d'envoi) et `src/routes/api/auth/send-email.ts` (route) ; les gabarits
dans `src/lib/email/templates.ts` (`buildAuthEmail`), avec leurs aperçus via
`bun run email:previews` (fichiers `19-auth-*` à `22-auth-*`).
