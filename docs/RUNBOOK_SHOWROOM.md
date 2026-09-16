# Showroom à ciel ouvert

Routes : `/lieux` (public), `/admin?tab=showroom` (administrateur existant).

## État

Migration additive : `20260916100000_showroom_locations.sql`, appliquée en production le 16 septembre 2026 sur `mkfztwibolswqcggukeq`, après autorisation explicite du propriétaire. Aucun lieu réel n'est prérempli. Les anciennes migrations Studio ne sont pas modifiées.

PROD MIGRATION SHOWROOM = OUI. Aucune adresse client ni photo de lieu réel ajoutée par ce chantier. La carte n'est pas déclarée DATA READY. Le registre est désormais disponible ; les administrateurs peuvent saisir les lieux. Aucune autre migration appliquée lors de cette activation.

Activation : essai transactionnel annulé, puis application de ce seul fichier et inscription dans l'historique dans une transaction atomique (lock timeout 5 s, statement timeout 30 s). Vérifications : registre vide, RLS active, bucket privé, RPC publique HTTP 200 avec `[]`, accès anonyme direct à la table refusé HTTP 401. Accueil, catalogue, lieux et compte HTTP 200. Aucun enregistrement commercial existant modifié. Le parcours complet de téléversement de photos avec une session administrateur n'a pas été testé en production.

## Ajouter un lieu

1. Ouvrir Lieux équipés dans l'administration, puis Ajouter un lieu.
2. Renseigner nom et adresse. Rechercher la commune et sélectionner le résultat exact, vérifier son code postal. La recherche utilise geo.api.gouv.fr et ne transmet que la ville ou le code postal, jamais l'adresse saisie.
3. Pour une adresse publique, zoomer puis cliquer sur l'établissement sur la carte. Le géocodage de rue n'est pas automatique ; ce point doit être confirmé par l'administrateur. Le centre de commune et la position exacte sont stockés séparément.
4. Associer les références réellement installées depuis le catalogue. Les photos peuvent être ajoutées ultérieurement (20 maximum, 5 Mo chacune). Les fichiers sont réencodés en JPEG pour supprimer EXIF/GPS et limités à 1800 pixels.
5. Conserver Interne jusqu'à l'accord. Documenter l'accord (date et référence) puis choisir Adresse publique ou Sur demande et enregistrer.

Sur demande : nom générique, commune et centre de commune uniquement dans le payload public. Vérifier que la description, les modalités et les photos approuvées ne révèlent pas l'adresse ni l'identité qu'on souhaite garder confidentielles. Aucun itinéraire n'est proposé pour ce mode. Le formulaire de visite utilise le formulaire de contact existant et l'identifiant public du lieu, sans URL contenant une adresse privée.

Pour dépublier : choisir Interne, puis enregistrer. Décocher l'accord remet également la visibilité à Interne. Les requêtes suivantes ne peuvent plus lister le lieu ni obtenir de nouveaux liens photo. Les liens signés déjà délivrés expirent après 5 minutes (et une copie déjà téléchargée ne peut être révoquée). Les objets retirés d'une fiche restent privés dans le bucket ; aucune suppression irréversible automatique.

## Sécurité

Table privée protégée par RLS / `is_admin()` existant. Le navigateur public appelle seulement `list_public_showroom_locations()`, fonction à projection explicite ; aucun `select *` sur la table privée. Les comptes non admin ne peuvent pas lire ou écrire les dossiers. Bucket `showroom-photos` privé, lecture autorisée uniquement pour les objets associés à un lieu publié avec accord, ou pour l'admin. Les images utilisent des URL signées courtes. Aucun service-role dans le navigateur. Pas de modification de l'authentification Supabase.

## Carte et recherche

Leaflet est chargé uniquement dans la carte. Fond OpenStreetMap, attribution conservée, tuiles standard sans préchargement ni téléchargement hors ligne. Respecter la politique https://operations.osmfoundation.org/policies/tiles/ ; service sans garantie de disponibilité. En cas d'échec du fond, la liste reste utilisable. Fournisseur à réévaluer en cas de trafic important. La commune recherchée reste dans l'état local de la page, sans analytics ni URL. Recherche France métropolitaine et communes ultramarines via https://geo.api.gouv.fr/decoupage-administratif/communes ; carte déplaçable mondialement. Distances approximatives à vol d'oiseau, depuis le centre de commune pour les lieux sur demande.

## Vérifications

Tests SQL PGlite : migration neuve, droits anon/client/admin, refus de publication sans accord, masquage des données précises, retrait de publication et de l'accès photo, contraintes des coordonnées/chemins. Tests navigateur : états vide/indisponible, recherche, sélection, parcours itinéraire ou demande, photos absentes, mobile. Les données synthétiques appartiennent uniquement aux tests, jamais à la carte réelle.

Validation du 16 septembre 2026 : 12 tests ciblés, `bun run check` (1097 réussis, 8 ignorés), sécurité (282 réussis), E2E showroom (8 réussis) et régression pages publiques (28 réussis). Build et scans des bundles réussis. Docker étant indisponible, la migration a été exécutée dans PostgreSQL embarqué PGlite avec tests de rôles ; un replay Supabase Docker et une validation du stockage réel restent à effectuer avant activation. Aucun SQL distant exécuté.
