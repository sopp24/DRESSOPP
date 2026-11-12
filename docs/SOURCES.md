# Sources et alimentation du catalogue DRESSOPP

## Répertoire permanent

Le répertoire éditorial de **236 enseignes** est conservé dans [`data/merchant-directory.json`](../data/merchant-directory.json). Il couvre les multimarques, le casual accessible, le premium, le luxe, le sport et les sneakers, les sous-vêtements, le streetwear asiatique, la seconde main et des marchés internationaux.

Chaque entrée comporte le nom, le domaine officiel, l'URL, la famille, le niveau de prix indicatif, la région et une priorité de collecte. Les 236 entrées sont des cibles de sourcing, pas la promesse que toutes publient des fiches récupérables. L'existence d'un lien boutique ne signifie pas qu'un flux API ou un accès robot est autorisé.

Les paramètres de rotation sont dans `data/public-sources.json`. La liste `sources` est vide par défaut : le collecteur lit donc les 236 entrées de `data/merchant-directory.json`.

## Rotation quotidienne

Le workflow `.github/workflows/refresh-public-catalog.yml` est exécuté chaque jour à 08 h 17 (Europe/Paris). Chaque passage sélectionne 36 enseignes :
- 12 sources à priorité haute (priorité 1) ;
- 24 sources complémentaires en rotation circulaire.

Les curseurs `priorityCursor` et `regularCursor` sont enregistrés dans `data/catalog-meta.json`. Le collecteur ne recommence donc pas toujours par les mêmes enseignes. Avec 236 sources, les enseignes prioritaires sont revues plus souvent et les autres parcourues par lots successifs. Les horaires GitHub Actions sont des heures cibles et peuvent être retardés.

Pour chaque enseigne, le robot :
1. lit `robots.txt` et les sitemaps annoncés ;
2. tente les sitemaps standard si aucun sitemap n'est déclaré ;
3. visite la page d'accueil et jusqu'à deux catégories pertinentes ;
4. examine jusqu'à 18 pages candidates et collecte jusqu'à 20 fiches par source ;
5. espace les requêtes sur chaque domaine et utilise quatre travailleurs maximum en parallèle.

## Pages et chargement progressif

Le catalogue n'est plus téléchargé en un seul gros fichier :
- `data/catalog-manifest.json` contient le nombre de produits et l'index des pages ;
- `data/catalog-pages/page-0001.json`, etc. contiennent 120 produits par page ;
- `data/catalog.json` conserve un aperçu de la première page pour les outils historiques ;
- `data/catalog-meta.json` conserve les résultats de collecte par boutique, les dates et les curseurs.

Le site charge la première page, puis précharge les suivantes lorsqu'il ne reste qu'environ huit produits à découvrir. En mode grille, le chargement suivant se déclenche aussi au défilement. Quand toutes les pages connues ont été parcourues, le navigateur vérifie périodiquement si un nouveau manifeste a été publié.

Le système n'a pas de limite artificielle de swipes ou de plafond global de produits. Le nombre de produits disponibles reste toutefois limité par les stocks et les données réellement publiées par les marchands.

## Extraction et fraîcheur

Les fiches importées nécessitent :
- un nom ;
- un prix en EUR ;
- un lien produit HTTPS sur le domaine de la boutique ;
- une image HTTPS.

Le collecteur lit les données structurées Schema.org `Product` et `Offer`, puis certaines métadonnées Open Graph en secours. Les fiches publiques ont une durée de fraîcheur de sept jours : si elles ne sont pas revalidées, elles sont marquées périmées et sortent de la découverte. Les références éditoriales restent conservées.

Le prix et le stock sont une photographie datée. Les prix hors EUR sont ignorés plutôt que convertis à l'aide d'un taux approximatif. Les prix, tailles et stocks doivent être vérifiés sur la boutique avant achat.

## Respect des accès et des droits

Le robot s'identifie comme DRESSOPPBot. Il respecte `robots.txt`, ralentit les requêtes et n'essaie pas de contourner :
- CAPTCHA ou protections anti-robots ;
- authentification ou espace client ;
- réponses HTTP 401, 403 ou 429 ;
- endpoints privés et APIs internes non documentées.

**Respecter robots.txt ne constitue pas une licence de réutilisation.** Les conditions des boutiques, les droits sur les textes, les marques, les images et les données doivent également être respectés. Le collecteur conserve l'URL publique de l'image et du produit ; il ne télécharge pas les photos de boutique.

Les enseignes qui bloquent les robots ou ne publient pas de données structurées restent accessibles comme liens dans le répertoire. Une page accessible à un humain n'est pas automatiquement une source autorisée ou exploitable pour une collecte automatisée.

## Priorités utilisateur et sources non commerciales

- Pinterest : priorité stylistique via le tableau `sopppx24/mode`, selon les autorisations décrites dans [`PINTEREST.md`](./PINTEREST.md).
- Zalando : priorité commerciale dans le répertoire. Son accès partenaire de catalogue ne donne pas accès à la wishlist privée d'un compte client. Ne jamais demander ou stocker le mot de passe Zalando.
- Avis : Trustpilot, Google Avis clients, Avis Vérifiés, Trusted Shops et Custplace ne sont utilisés que par des sources autorisées et vérifiables. Une note produit reste distincte d'une note de fiabilité du marchand.
- Publicités : Meta Ad Library peut donner accès à certaines publicités publiques, mais pas au fil Instagram personnalisé de l'utilisateur.

## Coûts et hébergement

- Le collecteur n'utilise pas d'API Shopping payante, de réseau d'affiliation ou de compte éditeur.
- Les runners standard GitHub Actions sont gratuits pour les dépôts publics selon les conditions GitHub : [tarifs GitHub](https://github.com/pricing).
- GitHub Pages est disponible avec GitHub Free pour les dépôts publics : [documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages).
- GitHub Pages n'est pas conçu comme hébergement gratuit pour une activité commerciale, un site e-commerce ou un SaaS : [limites GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Lancer et diagnostiquer

- Lancer le workflow : [Actions → Catalogue public](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml) → **Run workflow**.
- Résultats détaillés : `data/catalog-meta.json`.
- Liste de sources : `data/merchant-directory.json`.
- Paramètres de rotation : `data/public-sources.json`.
- Tests : `npm test`.
