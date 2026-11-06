# DRESSOPP

**Find your style. Build your identity.**

DRESSOPP est une plateforme personnelle de découverte de vêtements, chaussures, sous-vêtements et accessoires. Elle associe les inspirations Pinterest, un catalogue multi-boutiques, les décisions Oui/Non, une garde-robe et un moteur de recommandations qui apprend au fil des utilisations.

## Découverte et apprentissage

- Une pièce à la fois, en cartes ou en grille.
- **Non** : signal négatif ; **Oui** : intérêt ; **Ajouter à ma liste** : sauvegarde sans vote.
- Le moteur apprend des votes, des articles enregistrés, du profil, des tailles, des couleurs, matières, coupes, styles, du budget et de la saison.
- Les fiches sont classées selon la proximité avec les goûts et la fraîcheur de leurs données.
- Les tenues rapprochent les inspirations des pièces enregistrées ; aucun complément produit n'est inventé.

## Catalogue multi-sources gratuit

DRESSOPP n'utilise plus Awin. Le workflow `.github/workflows/refresh-public-catalog.yml` explore quotidiennement un répertoire de boutiques défini dans `data/public-sources.json` (Zalando, ASOS, UNIQLO, Zara, BZB, Pull & Bear, H&M, Mango, COS, ARKET, Nike, adidas, Courir, JD Sports, Calvin Klein, Undiz, Louis Vuitton, Dior, Lacoste, Levi's, Carhartt WIP, Sarenza, La Redoute, ABOUT YOU, Kiabi, Decathlon et d'autres).

Le collecteur gratuit :
- lit les sitemaps et les pages catégories publiques ;
- respecte les règles de `robots.txt`, limite le nombre de pages et espace les requêtes ;
- n'importe que les fiches avec nom, prix EUR, lien produit HTTPS et image HTTPS ;
- récupère les données structurées Schema.org Product et, en secours, les métadonnées Open Graph produit ;
- conserve les références manuelles, déduplique les URL et rend les fiches publiques périmées après sept jours sans nouvelle vérification.

**Limites importantes :** ce n'est pas un moteur de recherche universel ni un accès garanti à chaque référence d'une boutique. Certaines boutiques bloquent les robots, ne publient pas de sitemaps produits ou ne fournissent pas de données structurées exploitables. Ces sites restent accessibles par les liens officiels dans DRESSOPP et peuvent être ajoutés par import manuel. Les prix et stocks sont une photographie datée ; la vérification finale doit se faire sur la boutique. Aucun blocage technique n'est contourné.

Aucun abonnement, compte éditeur ou clé API payante n'est nécessaire. Le dépôt étant public, GitHub indique que l'utilisation des runners standard GitHub Actions est gratuite pour les dépôts publics. GitHub Pages est également disponible pour les dépôts publics avec GitHub Free. Attention : GitHub Pages n'est pas destiné à héberger gratuitement une activité commerciale, un site e-commerce ou un SaaS. DRESSOPP ne traite actuellement aucun paiement et ne vend aucun produit ; si le projet devient un service commercial, il faudra réévaluer l'hébergement au regard des conditions GitHub.

Pour lancer le premier passage : [GitHub Actions – Catalogue public](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml) → **Run workflow**.

Guide complet : [docs/SOURCES.md](docs/SOURCES.md).

## Recommandations communautaires facultatives

Le mode communautaire permet de comparer les goûts avec ceux d'autres utilisateurs DRESSOPP qui ont expressément accepté de contribuer. Il utilise des étiquettes de goûts pseudonymisées (styles, catégories, marques, couleurs, matières) et des identifiants hachés de fiches publiques aimées ou refusées. Le moteur peut ainsi détecter des profils proches et faire remonter un même article lorsqu'il a été apprécié par plusieurs membres similaires.

Cette fonction est **désactivée par défaut** et nécessite de créer un projet Firebase en plan Spark (gratuit), d'activer l'authentification anonyme et de publier les règles Firestore décrites dans [docs/COMMUNITY.md](docs/COMMUNITY.md). Aucun nom, e-mail, taille, budget, historique brut ni lien Pinterest n'est partagé. Les identifiants d'articles sont pseudonymisés, pas chiffrés ; un membre technique peut les rapprocher du catalogue public. Sans Firebase, l'apprentissage individuel continue de fonctionner sur l'appareil.

Les profils communautaires ne représentent que les membres DRESSOPP volontaires ; ils ne donnent pas accès aux recherches privées effectuées sur Google, Instagram ou d'autres applications.

## Pinterest

Le tableau `sopppx24/mode` demeure la référence stylistique prioritaire. Le workflow `.github/workflows/pinterest-daily.yml` est programmé chaque jour à 12 h (Europe/Paris), via Pinterest API v5. Son activation nécessite les identifiants de l'application Pinterest et les autorisations `boards:read` et `pins:read`. Le flux n'est publié dans le dépôt que si l'API confirme que le tableau est public.

Guide : [docs/PINTEREST.md](docs/PINTEREST.md).

## Fiabilité, avis et publicités

La note d'un article est séparée de la réputation générale de son marchand. DRESSOPP n'invente aucun score Trustpilot, Google, Avis Vérifiés, Trusted Shops ou Custplace et n'extrait pas les avis via des méthodes de contournement. Les données ne sont affichées que lorsqu'une source autorisée les fournit.

Meta Ad Library peut servir à repérer des publicités publiques en France, mais ne donne pas accès au fil publicitaire personnalisé d'un compte Instagram.

## Données et confidentialité

Les profils, tailles, votes, préférences, garde-robe et Pins consultés restent dans IndexedDB sur l'appareil, avec un repli localStorage. Le dépôt public ne contient aucun profil personnel ni historique de votes. Le partage communautaire est facultatif et désactivé initialement.

## Déploiement et développement

- Site : https://sopp24.github.io/DRESSOPP/
- Pages : GitHub Actions, configuré dans Settings → Pages → Build and deployment.
- Lancer localement : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000.
- Tests : `npm test`.

## Structure principale

- `app.js` : navigation, découverte, profils, votes et garde-robe.
- `modules/engine.js` : normalisation, filtrage, apprentissage et classement.
- `modules/community.js` : partage facultatif de signaux pseudonymisés Firebase.
- `modules/outfits.js` : rapprochement des inspirations Pinterest et des articles.
- `modules/store.js` : stockage local.
- `modules/integrations.js` : intégrations de l'application.
- `scripts/refresh-public-catalog.mjs` : exploration des boutiques publiques autorisées.
- `scripts/sync-pinterest.mjs` : synchronisation Pinterest officielle.
- `data/public-sources.json` : liste des boutiques explorées.
- `data/catalog.json` et `data/catalog-meta.json` : catalogue et compte-rendu de synchronisation.
- `.github/workflows/refresh-public-catalog.yml` : actualisation quotidienne du catalogue.
- `.github/workflows/pinterest-daily.yml` : synchronisation Pinterest.
