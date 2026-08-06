# Rebranding → Terrassea (terrassea.com)

> Décision 08/2026 : la marque publique devient **Terrassea** (6 mois
> d'audience Instagram), le site passe sur **terrassea.com**. Les contrats,
> factures et mentions légales restent **Pros Import EURL** (société
> officielle). « Terrassea est une marque de Pros Import EURL. »

## Stratégie en DEUX temps (décision 08/2026)

**Phase 1 — maintenant** : la marque Terrassea est visible partout, mais le
site reste servi sur **prosimport.com**. Tu peux tout déployer sans risque :
aucune redirection ne s'active tant que le flip n'est pas fait.

**Phase 2 — le jour J** (site terminé, terrassea.com branché dans
Cloudflare) : `bash scripts/flip-domaine-terrassea.sh` bascule TOUTES les
URLs de service + active les 301 prosimport → terrassea, puis gate, commit,
push, deploy, et les étapes infra ci-dessous.

## Fait côté code

- Marque « Terrassea » partout (header, hero, emails, SEO, PDF devis) ;
  mentions légales Pros Import EURL conservées (footer, CGV, contact, devis).
- `SITE_URL` reste https://prosimport.com en phase 1 ; le flip script le
  bascule (canonicals, OG, sitemaps, llms.txt, robots, feed Merchant, liens
  partenaires/QR, emails) en une commande.
- JSON-LD Organization : `name` Terrassea, `legalName` Pros Import EURL,
  `alternateName` [Container Club, Container Club Terrassea] et `sameAs`
  prosimport.com — Google relie l'entité historique, le SEO/GEO accumulé
  est transféré, pas perdu.
- Redirection 301 pilotée par UN hôte canonique dans `src/start.ts` : en
  phase 1, www.prosimport.com et les hôtes terrassea → prosimport.com ; après
  le flip, prosimport.com et www → terrassea.com (chemin + query conservés).
- Email public affiché : adrienlaniez1@gmail.com (contact, formulaires,
  devis). L'EXPÉDITEUR des emails transactionnels reste `BREVO_FROM` (env).

## À faire par Adrien LE JOUR J, dans l'ordre (après le flip script)

1. **Cloudflare — domaine** : ajouter terrassea.com à la zone, puis dans le
   worker `container-club` → Settings → Domains & Routes : ajouter
   `terrassea.com` et `www.terrassea.com` en custom domains. NE PAS retirer
   prosimport.com (il doit continuer d'atteindre le worker pour les 301).
2. **Env prod** : `VITE_APP_NAME=Terrassea` (Cloudflare Pages/Workers vars).
   `BREVO_FROM` : garder l'expéditeur actuel (domaine vérifié DKIM) tant que
   terrassea.com n'est pas vérifié dans Brevo ; après vérification, passer à
   `Terrassea <contact@terrassea.com>` avec redirection vers ta boîte.
3. **Supabase Auth** : Authentication → URL Configuration → Site URL =
   https://terrassea.com ; ajouter https://terrassea.com/** aux Redirect
   URLs (garder prosimport.com/** pendant la transition).
4. **Stripe** : vérifier les URLs de retour checkout (si configurées en dur
   dans le dashboard) et le nom affiché sur les reçus (peut rester Pros
   Import EURL — c'est l'entité qui encaisse).
5. **Search Console** : ajouter la propriété terrassea.com, soumettre les 2
   sitemaps, puis utiliser l'outil **« Changement d'adresse »** depuis la
   propriété prosimport.com → transfert d'index accéléré.
6. **Merchant Center** : le feed devient
   https://terrassea.com/product-feed.xml (re-vérifier le domaine).
7. **Instagram** : lien bio → https://terrassea.com. Si le handle exact
   diffère de @terrassea, me donner l'URL réelle pour corriger le `sameAs`
   du JSON-LD.
8. **CGV/mentions** : vérifier la formule « Terrassea, marque de Pros Import
   EURL » dans les CGV (page légale déjà alignée côté code).

## Vérifications post-bascule

```bash
curl -sI https://prosimport.com/catalogue | grep -i "location"
# attendu : Location: https://terrassea.com/catalogue (308/301)
curl -s https://terrassea.com/robots.txt | head -3
curl -s https://terrassea.com/llms.txt | head -3
```

Sur le site : header « Terrassea », page /contact « Parler à Terrassea » +
adrienlaniez1@gmail.com, footer légal Pros Import EURL intact, PDF devis
« Terrassea — édité par Pros Import EURL ».
