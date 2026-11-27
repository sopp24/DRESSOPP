# DRESSOPP

**Mode diligente.**

DRESSOPP est un personal shopper visuel consacré au vestiaire masculin. L'application aide à découvrir des vêtements, à préciser ses goûts et à composer des tenues à partir d'un catalogue multi-boutiques et d'inspirations Pinterest.

Son principe : **tu découvres une pièce, tu réponds Oui, Non ou tu l'ajoutes à ta liste ; la sélection apprend progressivement ce qui te correspond.** Les inspirations Pinterest donnent une direction stylistique, tandis que les fiches produits servent à retrouver des pièces réelles.

> DRESSOPP est un outil de découverte et de composition. Il renvoie vers les fiches des marchands, mais ne gère ni panier, ni paiement, ni commande.

## Accès

| Ressource | Adresse |
|---|---|
| Application | [sopp24.github.io/DRESSOPP](https://sopp24.github.io/DRESSOPP/) |
| Board de présentation interactif | [board.html](https://sopp24.github.io/DRESSOPP/board.html) |
| PDF A3 | [board.pdf](https://sopp24.github.io/DRESSOPP/board.pdf) |
| PDF imprimeur | [board-print-a3.pdf](https://sopp24.github.io/DRESSOPP/board-print-a3.pdf) |
| Politique de confidentialité | [privacy.html](https://sopp24.github.io/DRESSOPP/privacy.html) |
| Dépôt GitHub | [sopp24/DRESSOPP](https://github.com/sopp24/DRESSOPP) |

## L'expérience dans l'application

La navigation principale comporte six espaces : **Découvrir**, **Vêtements**, **Entraînement**, **Tenues**, **Profil** et **Réglages**. Sur mobile, une barre de navigation basse reprend les vues principales.

### Découvrir

Le flux présente une pièce à la fois, avec sa photo, son nom, sa marque, son prix, ses caractéristiques disponibles et un lien vers l'article original.

Les cinq commandes de la carte sont :

- **Annuler** : revenir sur la dernière décision ;
- **Passer / Non** : signaler que la pièce ne correspond pas ;
- **Ajouter à ma liste** : conserver l'article ;
- **J'aime / Oui** : signaler un intérêt ;
- **Partager** : partager la fiche produit.

Les gestes tactiles et souris permettent également de faire défiler les cartes. Les raccourcis clavier sont disponibles : flèche gauche pour passer, flèche droite pour aimer, flèche bas pour ajouter à la liste, Entrée pour ouvrir les détails et Ctrl/Cmd + Z pour annuler la dernière action.

Les articles déjà évalués ou enregistrés sont écartés du flux normal. Les filtres permettent de choisir une catégorie, un style, une saison et un budget maximum. Tu peux enregistrer plusieurs combinaisons de filtres et régler l'équilibre entre tes goûts connus et la découverte de nouvelles pièces.

### Vêtements

Cette vue rassemble les articles ajoutés à ta liste. Tu peux rechercher une pièce par nom, marque, matière ou couleur, filtrer par catégorie, style, saison et prix, puis trier par date d'ajout, prix ou nom.

Retirer un favori de la garde-robe ne crée pas de vote négatif dans le profil de style.

### Entraînement

L'entraînement reprend le flux de découverte avec un réglage qui favorise davantage l'exploration. Il affiche aussi l'évolution des décisions Oui/Non et des articles enregistrés.

Les inspirations Pinterest synchronisées ou ajoutées manuellement sont accessibles dans cette vue. Les cartes d'inspiration présentent les éléments visuels disponibles dans l'analyse : styles, couleurs, matières, coupes et pièces repérées. Un Pin peut être ouvert sur Pinterest, marqué comme vu ou utilisé pour démarrer une composition de tenue.

### Tenues

Les propositions de tenues partent exclusivement d'une inspiration Pinterest. DRESSOPP rapproche les pièces identifiées dans le Pin des produits du catalogue et des articles de ta garde-robe.

Tu peux préciser les styles souhaités, la saison et le budget total du look. Les propositions tiennent également compte de tes préférences et de tes tailles lorsqu'elles sont renseignées. Tu peux donner un avis positif ou négatif, ouvrir le détail d'un look, enregistrer une tenue complète ou conserver certaines pièces.

Une composition nécessite au moins deux articles. Si les fiches disponibles ne permettent pas de remplir les critères, l'application affiche un état vide plutôt que d'inventer des produits.

### Profil

Le profil est facultatif et sert à préciser :

- les tailles de hauts, bas, vestes, chaussures et sous-vêtements ;
- les marques, couleurs, matières, coupes et styles appréciés ou à éviter ;
- le niveau de confort et la coupe préférée ;
- des notes personnelles.

Ces informations affinent le classement et les propositions de tenues. Les tailles et notes personnelles ne sont pas envoyées au Worker IA distant.

### Réglages

Les réglages regroupent le suivi des synchronisations Pinterest et du catalogue, les options de partage communautaire, les informations sur les notes produit, les liens vers Meta Ad Library et les commandes de sauvegarde.

Tu peux exporter tes données au format JSON, restaurer une sauvegarde, importer un catalogue JSON ou supprimer toutes les données locales. L'application permet aussi d'ajouter manuellement un article ou une inspiration ; les formulaires demandent une confirmation du caractère masculin de la fiche ou de l'épingle.

## Apprentissage et classement

Le moteur local combine plusieurs familles de signaux :

- les réponses Oui et Non ;
- les articles enregistrés ;
- les préférences du profil ;
- les caractéristiques connues des produits : catégorie, marque, style, couleur, matière, coupe et motif ;
- les signaux stylistiques extraits des Pins Pinterest ;
- la saison, le budget, les tailles renseignées et la fraîcheur des fiches.

Les décisions récentes ont davantage de poids que les anciennes. Un article enregistré constitue un signal positif distinct d'un simple Oui ; un Non contribue à éviter les pièces similaires. Les filtres et le niveau de découverte modifient ensuite l'ordre des propositions.

La sélection est réservée aux pièces confirmées pour homme ou aux pièces unisexes explicitement adaptées au vestiaire masculin. Les fiches féminines, les pièces typiquement féminines et les articles dont le public n'est pas confirmé sont exclus par la règle commune de `modules/audience.js`.

## État des données — vérifié le 27 novembre 2026

Les compteurs ci-dessous sont un instantané des fichiers publiés, pas une promesse de disponibilité permanente. Le catalogue a été actualisé le **26 novembre 2026 à 17:46 UTC** ; le flux Pinterest a été synchronisé le **26 novembre 2026 à 19:54 UTC**.

### Catalogue multi-boutiques

| Indicateur | État publié |
|---|---:|
| Enseignes dans le répertoire | **255** |
| Fiches dans le manifeste | **489** |
| Fiches publiques actives | **200** |
| Références éditoriales | **16** |
| Fiches périmées | **273** |
| Enseignes ayant fourni des produits | **23** |
| Enseignes examinées lors du dernier passage | **36** |
| Pages consultées lors de ce passage | **275** |
| Pagination | **5 pages**, jusqu'à 120 fiches par page |

Le statut général de collecte est **partial**. Au dernier relevé, les résultats par enseigne comprenaient 23 sources productives, 75 bloquées, 140 sans données structurées exploitables et 17 indisponibles. Le répertoire est une liste de cibles de sourcing : sa présence ne signifie pas que chaque boutique fournit un flux exploitable.

Le répertoire est organisé en neuf familles :

| Famille | Enseignes |
|---|---:|
| Multi-marques & grands magasins | 32 |
| Accessible, casual & essentiels | 34 |
| Premium, heritage & créateurs | 57 |
| Luxe & maisons de mode | 33 |
| Sneakers, chaussures & sport | 29 |
| Sous-vêtements & essentiels | 17 |
| Streetwear & labels asiatiques | 26 |
| Seconde main & marketplaces mode | 8 |
| Amériques, Asie-Pacifique & autres marchés | 19 |
| **Total** | **255** |

Le collecteur public exige une fiche avec un nom, un prix en euros, un lien produit HTTPS et une image HTTPS. Il lit les sitemaps et les données structurées Schema.org `Product` / `Offer`, avec certaines métadonnées Open Graph en secours. Les fiches publiques non revalidées au-delà de leur durée de fraîcheur sont marquées périmées et sortent de la découverte.

Les prix et stocks sont une photographie du dernier contrôle. Ils doivent être vérifiés sur le site marchand avant tout achat. Le robot respecte `robots.txt`, espace les requêtes et ne contourne ni authentification, ni CAPTCHA, ni blocage HTTP 401/403/429. Respecter `robots.txt` ne constitue pas une licence de réutilisation des contenus.

### Pinterest

Le tableau de référence est [sopppx24 / mode](https://fr.pinterest.com/sopppx24/mode/). Le flux publié dans `data/pinterest-pins.json` contient **60 épingles** et confirme que le tableau est public. **59 épingles disposent d'une analyse visuelle version 5** lors de la dernière synchronisation. 55 sont classées comme mode masculine ; les épingles unisexes, ambiguës ou non vestimentaires ne sont pas considérées comme des inspirations masculines confirmées.

La synchronisation utilise l'API officielle Pinterest v5. Le Worker Cloudflare analyse les images publiques accessibles sur le CDN Pinterest et renvoie des éléments structurés : public, résumé, styles, couleurs, matières, coupes, motifs, pièces visibles, détails, silhouette, superpositions, saisons et formules de tenue.

Ces analyses alimentent le moteur de découverte et les rapprochements entre les inspirations et les produits. Un Pin reste une source d'inspiration : il n'est jamais transformé en fiche marchande, prix ou lien produit fictif.

### Mode démo du board

La page [board.html](https://sopp24.github.io/DRESSOPP/board.html) contient trois vues interactives intégrées : Découvrir sur ordinateur, Entraînement sur mobile et Tenues sur mobile.

La démonstration repose sur deux fichiers fixes :

- `data/demo-catalog.json` : **10 articles**, 9 marques et 10 catégories ;
- `data/demo-pinterest-pins.json` : **6 inspirations**.

Le mode démo charge uniquement ces deux fichiers : il ne consulte pas le manifeste du catalogue réel, le répertoire des boutiques ni le flux Pinterest réel. Les vues embarquées n'appellent pas le stockage personnel IndexedDB/localStorage ; les votes, favoris et autres essais restent en mémoire pendant la session. Les préférences et données du dressing réel ne sont donc pas modifiées.

Les exports du board sont conservés à la racine du dépôt :

- `board.pdf` : PDF de présentation ;
- `board-print-a3.pdf` : version destinée à l'impression.

Les boutons du header de `board.html` ouvrent ces fichiers. Le workflow de publication préserve chaque PDF déjà présent ; il ne génère que les fichiers manquants.

## Personal shopper IA

### Mode local

Le personal shopper local fonctionne dans le navigateur, sans clé API ni transfert de données. Il croise les filtres, le profil, les votes, les articles enregistrés, les caractéristiques des produits et les analyses Pinterest disponibles. Il classe uniquement des produits déjà présents dans le catalogue et peut expliquer les correspondances retenues.

### Mode Cloudflare facultatif

Le dépôt contient un Worker Cloudflare configuré avec le modèle `@cf/google/gemma-4-26b-a4b-it`. Son endpoint est défini dans `data/ai-agent-config.json` :

`https://dressopp-agent.asoppelsa.workers.dev`

Le mode distant ne fonctionne qu'après consentement explicite dans le panneau du personal shopper. Le navigateur transmet alors des filtres, des préférences générales, un résumé des retours récents et jusqu'à 50 fiches candidates. Les tailles exactes, notes personnelles, adresses e-mail, URL de produits et images ne font pas partie du payload de recommandation. Le Worker classe les produits transmis : il ne fait pas de recherche Internet autonome et ne crée pas de nouveaux articles.

L'option d'actualisation automatique est distincte ; lorsqu'elle est activée, l'agent peut être relancé après trois nouvelles décisions. Si le Worker est indisponible ou si le consentement n'est pas donné, le classement local reste disponible.

Le même Worker fournit la route serveur d'analyse des images Pinterest. Les routes principales sont `/health`, `/recommend` et `/analyze-pins`.

Guide : [docs/AI-AGENT.md](./docs/AI-AGENT.md).

## Confidentialité et stockage

DRESSOPP ne demande pas de compte, de mot de passe ou d'adresse e-mail pour les fonctions principales.

- Le profil, les votes, les filtres, les favoris, les tenues et les inspirations manuelles sont conservés sur l'appareil, principalement dans **IndexedDB**, avec un repli dans **localStorage**.
- Les sauvegardes sont exportées en JSON et peuvent être réimportées depuis les paramètres.
- Les images importées manuellement restent dans le stockage local du navigateur.
- Le partage communautaire Firebase est **désactivé et non configuré** dans la version publiée (`enabled: false`). Il nécessite une configuration Firestore, des règles de sécurité et un consentement explicite.
- Si le partage communautaire est activé ultérieurement, il transmet des étiquettes générales de goûts et des identifiants hachés de fiches publiques. Ces identifiants sont pseudonymisés, pas anonymes ni chiffrés.
- Le flux Pinterest et le catalogue sont publiés dans un dépôt GitHub public. Le contenu et les métadonnées de ces fichiers ne sont donc pas privés.
- Les secrets Pinterest et Cloudflare doivent rester dans les secrets GitHub Actions et Cloudflare ; ils ne doivent jamais être committés.

L'application ne peut pas lire ton compte Zalando, ta wishlist personnelle ou ton fil Instagram publicitaire personnalisé. La section Meta Ad Library ouvre une bibliothèque de publicités publiques ; elle ne constitue pas un collecteur automatique. Les notes de produit, lorsqu'elles existent dans une fiche source, restent distinctes de la fiabilité du marchand : aucun connecteur Trustpilot, Google Avis, Avis Vérifiés, Trusted Shops ou Custplace n'est intégré.

Politique complète : [privacy.html](https://sopp24.github.io/DRESSOPP/privacy.html).

## PWA, responsive et interface

DRESSOPP est une application web statique conçue pour ordinateur, tablette et mobile :

- le manifeste `manifest.webmanifest` décrit l'application installable en mode autonome ;
- le service worker `sw.js` met en cache les ressources essentielles, les polices, les icônes et la première page du catalogue ;
- les réponses GET du même domaine sont mises en cache après chargement réussi, avec recours au cache lorsqu'une ressource n'est plus accessible sur le réseau ;
- l'interface utilise Poppins et une direction visuelle sombre ;
- les interactions de swipe, les boutons et la navigation mobile sont testés sur plusieurs formats d'écran.

Le cache hors ligne porte sur les ressources déjà mises en cache ; il ne garantit pas que toutes les pages du catalogue, les images distantes ou les fonctions nécessitant une API soient disponibles sans connexion.

## Automatisations GitHub Actions

| Workflow | Déclenchement | Rôle |
|---|---|---|
| [Deploy DRESSOPP to GitHub Pages](https://github.com/sopp24/DRESSOPP/actions/workflows/deploy-pages.yml) | Push sur `main` ou lancement manuel | Lance `npm test`, installe Chromium, génère les PDF manquants si besoin, publie le site et déclenche le contrôle visuel responsive. |
| [Catalogue public multi-sources](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml) | Chaque jour à **08:17** (Europe/Paris), certains changements de fichiers ou lancement manuel | Examine un lot de 36 enseignes : 12 priorités et 24 en rotation. Met à jour les pages, le manifeste et les métadonnées du catalogue si des données changent. |
| [Synchronisation Pinterest quotidienne](https://github.com/sopp24/DRESSOPP/actions/workflows/pinterest-daily.yml) | Chaque jour à **12:00** (Europe/Paris), changement du workflow ou lancement manuel | Synchronise le tableau public via Pinterest API v5, enrichit les images éligibles avec l'analyse visuelle et publie le flux si celui-ci change. |
| [Responsive QA (pre-merge)](https://github.com/sopp24/DRESSOPP/actions/workflows/responsive-qa.yml) | Pull request vers `main`, branche de QA dédiée ou lancement manuel | Lance les tests et vérifie les mises en page et interactions dans Chromium. |

Les horaires cron sont des heures cibles : GitHub Actions peut retarder le démarrage. Le contrôle visuel après déploiement teste six formats d'écran et les interactions essentielles ; les captures et rapports sont publiés comme artefacts de workflow.

### Secrets nécessaires aux automatisations

Pour synchroniser Pinterest, le workflow utilise les secrets GitHub Actions suivants :

- `PINTEREST_APP_ID` et `PINTEREST_APP_SECRET`, ou un `PINTEREST_ACCESS_TOKEN` ;
- `PINTEREST_SYNC_TOKEN`, qui doit correspondre au secret configuré sur le Worker Cloudflare.

Le nom du tableau est `mode`. Les scopes publics utilisés sont `boards:read` et `pins:read`. Le workflow n'a pas vocation à publier des tableaux privés dans ce dépôt public.

Le collecteur de catalogue public n'utilise pas d'identifiant de compte marchand ; il lit uniquement les pages accessibles conformément aux règles d'accès. Le partage Firebase reste désactivé tant que `data/community-config.json` n'est pas configuré.

## Développement local

### Prérequis

- Node.js **22** pour exécuter les tests et les workflows ;
- Python 3 ou un autre serveur HTTP statique pour ouvrir le site localement.

Le dépôt utilise des modules JavaScript natifs et ne nécessite pas d'étape de compilation pour lancer l'application.

### Lancer le site

Depuis la racine du dépôt :

```bash
python3 -m http.server 8000
```

Ouvre ensuite [http://localhost:8000](http://localhost:8000).

### Lancer les tests

```bash
npm test
```

La commande vérifie la syntaxe des modules principaux et du Worker, puis lance la suite de tests Node.js. Les tests couvrent notamment le flux de découverte, l'apprentissage, l'éligibilité masculine, les tenues Pinterest, le stockage local, les fonctions de démonstration, les PDF et les workflows.

### Contrôle visuel responsive

Le script `scripts/visual-qa.mjs` utilise Playwright/Chromium pour ouvrir les vues principales, vérifier les dimensions, débordements, interactions tactiles et captures. Les workflows installent Playwright et Chromium à la volée ; aucun dossier `node_modules` n'est nécessaire dans le dépôt pour publier le site.

### Déployer le Worker Cloudflare

Depuis la racine du dépôt, avec un compte Cloudflare autorisé :

```bash
npx wrangler deploy --config workers/dressopp-agent/wrangler.jsonc
```

Les secrets du Worker doivent être configurés séparément sur Cloudflare. Le guide de déploiement se trouve dans [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Architecture du dépôt

| Chemin | Rôle |
|---|---|
| `index.html` | Shell de l'application, navigation, zones d'affichage et liens globaux. |
| `app.js` | Rendu des vues, interactions, formulaires, chargement du catalogue et orchestration des modules. |
| `styles.css` | Direction visuelle, cartes, animations, responsive et navigation mobile. |
| `modules/audience.js` | Règle commune d'éligibilité homme / unisexe adapté. |
| `modules/engine.js` | État initial, filtres, préférences apprises, score et classement des produits. |
| `modules/agent.js` | Agent local, préparation des données et appel facultatif au Worker Cloudflare. |
| `modules/outfits.js` | Lecture des signaux Pinterest, rapprochements produits/épingles et composition des tenues. |
| `modules/store.js` | Persistance IndexedDB et repli localStorage. |
| `modules/community.js` | Construction et synchronisation facultative des signaux communautaires Firebase. |
| `modules/integrations.js` | Informations sur la persistance et les intégrations référencées dans l'interface. |
| `data/merchant-directory.json` | Répertoire des 255 enseignes candidates. |
| `data/public-sources.json` | Taille des lots et paramètres de rotation du collecteur. |
| `data/catalog-manifest.json` | Compteurs, pagination et index des pages produits. |
| `data/catalog-pages/` | Catalogue multi-pages (120 fiches maximum par page). |
| `data/catalog.json` | Aperçu de compatibilité de la première page. |
| `data/catalog-meta.json` | État des collectes, dates, résultats par enseigne et curseurs de rotation. |
| `data/catalog-seeds.json` | Références éditoriales conservées par le collecteur. |
| `data/pinterest-pins.json` | Flux public des Pins synchronisés et de leurs analyses visuelles. |
| `data/demo-catalog.json` / `data/demo-pinterest-pins.json` | Jeux fixes du board de démonstration. |
| `data/ai-agent-config.json` | Activation et endpoint du Worker de recommandation. |
| `data/community-config.json` | Configuration Firebase facultative (désactivée dans la version publiée). |
| `assets/product-images/` | Images produit référencées localement par le catalogue. |
| `workers/dressopp-agent/` | Worker Cloudflare pour les recommandations et l'analyse visuelle Pinterest. |
| `scripts/refresh-public-catalog.mjs` | Collecte tournante des fiches produits publiques. |
| `scripts/sync-pinterest.mjs` | Synchronisation Pinterest et enrichissement des analyses. |
| `scripts/generate-board-pdf.mjs` | Génération des PDF A3 lorsque les fichiers correspondants ne sont pas déjà fournis. |
| `scripts/visual-qa.mjs` | Contrôle visuel responsive et interactions avec Playwright. |
| `tests/` | Tests unitaires, règles de classement, confidentialité et intégrations. |
| `docs/` | Guides détaillés sur les sources, l'agent IA, Pinterest, la communauté et le déploiement. |

### Documentation complémentaire

- [Sources et alimentation du catalogue](./docs/SOURCES.md)
- [Personal shopper IA](./docs/AI-AGENT.md)
- [Pinterest et analyse visuelle](./docs/PINTEREST.md)
- [Partage communautaire Firebase](./docs/COMMUNITY.md)
- [Déploiement](./docs/DEPLOYMENT.md)

Les compteurs et dates de ce README sont issus des fichiers JSON publiés au 27 novembre 2026. Pour les chiffres les plus récents, les sources de vérité sont `data/catalog-manifest.json`, `data/catalog-meta.json`, `data/merchant-directory.json` et `data/pinterest-pins.json`. Certains guides techniques peuvent conserver des exemples ou compteurs historiques ; les données JSON publiées font foi pour l'état courant.
