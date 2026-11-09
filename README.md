# DRESSOPP

**Find your style. Build your identity.**

DRESSOPP est un personal shopper visuel pour la mode masculine et les marques mixtes : une expérience de découverte façon Tinder, construite autour d'un lookbook local, d'un catalogue multi-boutiques et d'un moteur qui apprend de chaque réponse Oui, Non et de chaque article sauvegardé. Une synchronisation Pinterest officielle est prévue dans le projet et devient exploitable lorsque le tableau et les autorisations sont effectivement connectés.

Site : https://sopp24.github.io/DRESSOPP/

## État vérifié du dépôt — 9 novembre 2026

Les éléments ci-dessous ont été comparés aux fichiers réellement présents sur la branche `main`. Les compteurs de catalogue sont un instantané daté, pas une promesse de volume permanent.

| Élément | État constaté |
|---|---|
| Répertoire des boutiques | **200 enseignes** ; les neuf catégories et leurs sous-totaux du README correspondent exactement à `data/merchant-directory.json`. Aucun doublon de nom ou de domaine détecté. |
| Dernier catalogue publié | Généré le **8 novembre 2026 à 14:21:12 UTC** ; statut `partial`. |
| Fiches du catalogue | **108 au total** : 78 fiches publiques actives, 16 références éditoriales et 14 fiches publiques périmées. |
| Sources actives du dernier instantané | 78 fiches publiques réparties entre BZB (18), Jules (18), Carhartt WIP (12), Courir (17), Foot Locker (5) et C.P. Company (8). |
| Dernière collecte | 36 enseignes examinées et 200 pages contrôlées pendant cette exécution. |
| Pinterest | `privacy: UNKNOWN`, `lastSync: null`, **0 Pin synchronisé**. Le lookbook local contient toutefois 20 références visuelles distinctes. |
| Personal shopper IA | Le mode local est disponible. L'actualisation automatique est désactivée par défaut. Un endpoint Cloudflare est renseigné, mais sa disponibilité en ligne doit être vérifiée séparément. |
| Partage communautaire | Désactivé et non configuré dans les fichiers publiés (`enabled: false`, sans identifiants de projet). |
| Avis | 25 fiches sur 108 comportent une note de **produit** ; aucune ne comporte actuellement de note de **marchand**. |

Le statut `partial` signifie que la collecte ne produit pas encore des fiches exploitables auprès de toutes les enseignes visées. Le répertoire de 200 boutiques est une liste de cibles, pas 200 flux marchands déjà connectés.

## Brief utilisateur — priorités permanentes

Cette section conserve la demande de référence pour faire évoluer les sources et les recommandations. Elle ne doit pas être remplacée par une simple liste de boutiques crawlables.

1. **Pinterest en priorité stylistique.** Tableau principal : https://fr.pinterest.com/sopppx24/mode/. Le tableau peut contenir autre chose que des vêtements ; ses images, titres, descriptions et tags sont des inspirations de goût, avec une majorité de références vestimentaires. L'algorithme doit en extraire les styles, couleurs, matières, coupes et associations sans considérer chaque Pin comme une fiche produit.
2. **Zalando en priorité commerciale.** Zalando est bien présent dans le répertoire avec une priorité de collecte élevée. En revanche, aucune API catalogue partenaire ni connexion à un compte client Zalando n'est configurée dans ce dépôt. Lors de la dernière collecte enregistrée (8 novembre 2026), le domaine Zalando a été signalé comme bloqué/inaccessible au robot ; cela n'empêche pas la présence de références éditoriales liées à Zalando dans le catalogue. Aucune wishlist personnelle n'est actuellement lue et aucun mot de passe ne doit être demandé ou stocké. Un import de wishlist n'est pas encore automatisé : il faudrait d'abord définir et valider un format d'export compatible.
3. **Adapter les propositions au style, à la catégorie et au budget.** Les univers prioritaires comprennent les multimarques (Zalando, ASOS, UNIQLO…), l'accessible/casual (BZB, Pull & Bear…), le premium et le luxe (Louis Vuitton, Dior, Lothaire…), les sneakers et le sport (Nike, adidas, Courir…) et les sous-vêtements (Calvin Klein, Undiz…).
4. **Fiabilité des marchands.** Trustpilot, Google Avis clients, Avis Vérifiés, Trusted Shops et Custplace sont des sources envisagées, pas des connecteurs actuellement intégrés. Le collecteur public ne renseigne pas les notes de marchands ; il peut récupérer une note de produit publiée dans les données structurées Schema.org. Une note produit ne doit jamais être assimilée à la fiabilité du vendeur.
5. **Publicités mode.** Meta Ad Library est une piste de veille, mais aucun collecteur Meta Ad Library n'est actuellement présent dans le dépôt. Si cette source est ajoutée, elle devra se limiter aux données publiques accessibles par un moyen autorisé. Elle ne donne pas accès au fil Instagram personnalisé de l'utilisateur et ne prouve pas qu'un produit est apprécié personnellement.
6. **Couverture internationale.** Le répertoire comprend 200 enseignes pour homme ou mixtes, dans les mêmes univers que les références fournies. Les pays, devises, livraison et accès techniques varient selon les enseignes.

## Expérience de découverte en flux continu

- Une pièce à la fois en mode swipe, ou une grille.
- Glisser à gauche / **Non** : préférence négative ; glisser à droite / **Oui** : intérêt ; **Ajouter à ma liste** : sauvegarde.
- Les articles déjà évalués ou sauvegardés ne reviennent pas dans le flux normal.
- Le moteur local classe les produits selon les préférences apprises, le profil, les tailles, les marques, les couleurs, matières, coupes, le style, le budget, la saison et la fraîcheur des fiches.
- Le catalogue est découpé en pages de 120 produits. Le site charge la première page, puis précharge la suivante quand il reste environ huit propositions à découvrir. En mode grille, le prochain lot se charge aussi au défilement.
- Quand toutes les pages publiées ont été parcourues, le site vérifie périodiquement si un nouveau manifeste est disponible. Une nouvelle collecte peut donc être consommée sans recharger manuellement l'application.
- Le workflow catalogue explore **36 enseignes par jour** parmi les 200, dont 12 priorités hautes et 24 sources en rotation. Les curseurs de rotation sont conservés dans `data/catalog-meta.json`.
- Ce fonctionnement supprime la limite artificielle de swipes. Il ne promet pas une infinité mathématique de vêtements : le volume réel dépend des produits que les sources publient, de leurs accès autorisés et de la disponibilité des articles. L'instantané publié le 8 novembre 2026 contient 78 fiches publiques actives ; le statut général de la collecte reste `partial`.

## Le répertoire permanent des 200 enseignes

Le fichier de référence et ses métadonnées (domaine, URL, famille, gamme de prix indicative, région, priorité et statut de collecte) sont dans [`data/merchant-directory.json`](./data/merchant-directory.json). La liste est éditoriale, adaptée au brief, et n'est pas un classement mondial par chiffre d'affaires. Sa présence ne garantit ni que la boutique accepte le crawl, ni qu'elle livre dans tous les pays, ni qu'elle expose des fiches exploitables.

### Multi-marques & grands magasins (25)

Zalando · ASOS · ABOUT YOU · La Redoute · Galeries Lafayette · Printemps · 24S · Farfetch · SSENSE · END. · MR PORTER · Mytheresa · LUISAVIAROMA · YOOX · Browns · Selfridges · Harrods · Flannels · Nordstrom · Macy's · Urban Outfitters · NEXT · Marks & Spencer · Boozt · Care of Carl

### Accessible, casual & essentiels (27)

UNIQLO · Zara · BZB · Pull & Bear · Bershka · H&M · Mango Man · C&A · Celio · Jules · Kiabi · Primark · GAP · J.Crew · Abercrombie & Fitch · Hollister · American Eagle · Cotton On · PacSun · Selected Homme · Only & Sons · Jack & Jones · GU · MUJI · River Island · Industrie · The Iconic

### Premium, heritage & créateurs (35)

COS · ARKET · Massimo Dutti · Levi's · Carhartt WIP · Weekday · Charles Tyrwhitt · Lacoste · Fred Perry · Tommy Hilfiger · Polo Ralph Lauren · GANT · Barbour · Paul Smith · Sandro · AMI Paris · A.P.C. · Maison Kitsuné · Acne Studios · Our Legacy · Norse Projects · Folk · Universal Works · Percival · Edwin · Nudie Jeans · G-Star RAW · Diesel · Wrangler · Lee · Dickies · Filson · Rains · K-Way · Lothaire

### Luxe & maisons de mode (25)

Louis Vuitton · Dior · Gucci · Prada · Saint Laurent · Balenciaga · Bottega Veneta · Celine · Loewe · Givenchy · Burberry · Moncler · Canada Goose · Stone Island · C.P. Company · Loro Piana · Zegna · Brunello Cucinelli · Hermès · Maison Margiela · Jacquemus · Off-White · Valentino · Alexander McQueen · Kenzo

### Sneakers, chaussures & sport (25)

Nike · adidas · New Balance · Puma · ASICS · Converse · Courir · JD Sports · Foot Locker · SNIPES · Decathlon · Footpatrol · Size? · BSTN · Asphaltgold · Vans · Reebok · On · HOKA · Salomon · Mizuno · Saucony · VEJA · Autry · Golden Goose

### Sous-vêtements & essentiels (17)

Calvin Klein · Undiz · Intimissimi Uomo · HOM · Sloggi · DIM · Hanes · Jockey · Björn Borg · SAXX · CDLP · Sunspel · Derek Rose · Zimmerli · Pump! · Falke · Skims

### Streetwear & labels asiatiques (19)

BAPE · Human Made · NEEDLES · COMME des GARÇONS · Yohji Yamamoto · ISSEY MIYAKE · Ader Error · thisisneverthat · MUSINSA · BEAMS · United Arrows · NANO universe · Urban Research · Stüssy · Supreme · Palace · Kith · Represent · Dover Street Market

### Seconde main & marketplaces mode (8)

Vestiaire Collective · Vinted · Depop · Grailed · StockX · GOAT · The RealReal · eBay

### Amériques, Asie-Pacifique & autres marchés (19)

Myntra · AJIO · Tata CLiQ Fashion · Renner · Dafiti · Reserva · Hering · Osklen · Liverpool · El Palacio de Hierro · Falabella · Ripley · Netshoes · Centauro · Country Road · Assembly Label · Academy Brand · David Jones · Riachuelo

## Collecte et qualité des fiches

Le collecteur `scripts/refresh-public-catalog.mjs` :
- sélectionne un lot tournant dans le répertoire ; les boutiques prioritaires sont revisitées plus souvent ;
- lit les sitemaps et les pages publiques en respectant `robots.txt` ;
- limite les pages explorées et espace les requêtes par domaine ;
- extrait les produits structurés Schema.org et, en secours, certaines métadonnées Open Graph ;
- exige un nom, un prix en EUR, une URL produit HTTPS et une image HTTPS ;
- déduplique les fiches par URL, conserve les références éditoriales et marque les fiches périmées ;
- ne contourne ni authentification, ni CAPTCHA, ni blocage HTTP 401/403/429.

La synchronisation publie :
- [`data/catalog-manifest.json`](./data/catalog-manifest.json) : index des pages et compteurs ;
- `data/catalog-pages/page-XXXX.json` : pages de produits ;
- [`data/catalog-meta.json`](./data/catalog-meta.json) : état des sources, dates, résultats et curseurs ;
- [`data/catalog.json`](./data/catalog.json) : aperçu de compatibilité (première page).

Le prix et le stock correspondent au dernier contrôle. Le marchand reste la référence avant achat. Les descriptions, images et autres contenus restent soumis aux conditions des boutiques et aux droits applicables ; respecter `robots.txt` ne constitue pas une licence générale de réutilisation. Les pages inaccessibles ou dépourvues de données structurées sont signalées et non contournées.

## Personal shopper IA intégré

Le personal shopper local est **disponible sans configuration externe**. L'utilisateur le lance depuis le panneau dédié ; il croise les préférences, les votes Oui/Non, les favoris, les attributs des vêtements et les tags/titres des inspirations réellement chargées (lookbook et, lorsque synchronisé, Pinterest). Il diversifie les boutiques et les catégories, et explique ses recommandations à partir des informations présentes dans les fiches. Ce mode fonctionne dans le navigateur, sans clé API ni transfert de données. L'actualisation automatique est une option distincte, désactivée par défaut ; lorsqu'elle est activée, l'analyse peut être relancée après trois nouvelles décisions.

Un mode génératif Cloudflare Workers AI est prévu en complément. Le dépôt référence le modèle `@cf/google/gemma-4-26b-a4b-it` ([documentation Cloudflare](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)) et contient le code du Worker dans `workers/dressopp-agent/`. Le fichier `data/ai-agent-config.json` active cette option et renseigne un endpoint, mais la seule présence de cette configuration ne garantit pas que le Worker est encore déployé ou joignable. Vérifier son état avec [l'endpoint de santé](https://dressopp-agent.asoppelsa.workers.dev/health) avant de considérer le service distant comme opérationnel. Le modèle distant n'est appelé qu'après accord explicite dans DRESSOPP. En cas d'erreur ou d'indisponibilité, le personal shopper local prend le relais.

L'agent classe au maximum 50 candidats déjà présents dans le catalogue. Il ne fabrique pas de produits et ne remplace pas le collecteur : les connecteurs et la collecte quotidienne trouvent les pièces réelles, l'agent choisit celles à afficher en premier. L'option d'actualisation automatique relance l'analyse locale après trois nouvelles décisions ; l'envoi à Cloudflare n'a lieu que si le consentement est actif.

## Pinterest — source stylistique prioritaire

Le tableau `sopppx24/mode` est la référence d'inspiration. Le workflow `.github/workflows/pinterest-daily.yml` synchronise le tableau via Pinterest API v5 lorsque l'application et les secrets sont configurés. Le flux actuel utilise les autorisations `boards:read` et `pins:read` et peut employer le flux Client Credentials pour les ressources publiques ([documentation officielle Pinterest](https://dev.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)). Le tableau doit être public pour le mécanisme de publication actuel dans ce dépôt public. Les tableaux secrets nécessitent une autorisation utilisateur adaptée et un stockage privé : ne jamais publier des Pins privés dans ce dépôt.

**État actuel :** `data/pinterest-pins.json` indique `privacy: UNKNOWN`, sans date de dernière synchronisation et avec une liste `pins` vide. Il ne faut donc pas présenter le compte Pinterest comme connecté ni dire que ses Pins alimentent déjà les recommandations. Le moteur dispose en revanche du lookbook local de 20 références décrit dans `data/lookbook-pins.json`.

La synchronisation utilise `boards:read` et `pins:read`. Pour connecter l'application, il faut configurer l'application Pinterest et les secrets GitHub décrits dans [`docs/PINTEREST.md`](./docs/PINTEREST.md). Aucune connexion active ne doit être annoncée tant que le flux confirme `privacy: PUBLIC` et contient les Pins.

## Zalando et comptes personnels

Zalando est une source prioritaire du répertoire, mais le dépôt ne contient actuellement ni connecteur partenaire Zalando ni connexion à un compte client. La dernière collecte enregistrée a signalé le domaine comme bloqué/inaccessible au robot. DRESSOPP ne doit jamais demander le mot de passe Zalando, automatiser une connexion en contournant les protections ou prétendre avoir accès à une wishlist qui n'a pas été fournie. Un éventuel import manuel nécessitera un format compatible à définir ; aucun importateur de wishlist Zalando dédié n'est actuellement implémenté.

## Avis marchands, popularité et publicités

Les plateformes citées dans le brief (Trustpilot, Google Avis clients, Avis Vérifiés, Trusted Shops, Custplace) ne constituent pas un flux libre et universel. **Aucun connecteur direct vers ces plateformes n'est actuellement implémenté.** Le collecteur peut lire une note de produit lorsqu'elle apparaît dans les données structurées Schema.org de la fiche ; il renseigne séparément `productRating` et laisse `merchantRating` vide pour les fiches importées du Web public. Dans l'instantané du 8 novembre 2026, 25 fiches sur 108 ont une note de produit et aucune n'a une note de marchand. Une donnée de réputation future ne sera utilisable que si son origine, sa date, sa portée et les droits d'accès sont vérifiables.

Meta Ad Library peut aider à analyser certaines publicités publiques, mais **aucune intégration de cette source n'est actuellement implémentée**. Elle ne permet pas de reconstruire le fil publicitaire personnalisé d'un compte Instagram. Une publicité est un signal de visibilité, pas une preuve de qualité, de stock ou de préférence personnelle.

## Vie privée et données

Par défaut, le profil, les tailles, les votes, les préférences, la garde-robe et les interactions sont stockés dans IndexedDB, avec un repli localStorage. Le classement et le personal shopper local ne transmettent pas ces données. **Si l'utilisateur donne son consentement au mode Cloudflare**, un sous-ensemble de préférences générales, filtres, retours récents et résumés de 50 fiches candidates maximum est transmis au Worker ; les tailles exactes, notes privées, e-mail, URL et images ne font pas partie du payload décrit par les tests. Le consentement peut être retiré.

Le partage communautaire est actuellement désactivé et non configuré dans `data/community-config.json`. S'il est activé ultérieurement, DRESSOPP transmet des étiquettes de goûts et des identifiants hachés de fiches publiques à Firebase. Ces identifiants sont pseudonymisés, pas anonymes au sens strict ; les règles décrites dans `docs/COMMUNITY.md` permettent aux utilisateurs authentifiés de lire les profils communautaires. Lire cette documentation et configurer les règles Firestore avant toute activation.

Le dépôt est public : seules des données de sources publiques doivent y être publiées. La synchronisation Pinterest publique ne doit contenir que des Pins d'un tableau confirmé public. Aucun identifiant ou mot de passe Zalando/Pinterest ne doit être committé.

## Automatisations GitHub

- Catalogue : [workflow catalogue](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml), planifié chaque jour à 08 h 17 (Europe/Paris).
- Pinterest : [workflow Pinterest](https://github.com/sopp24/DRESSOPP/actions/workflows/pinterest-daily.yml), planifié chaque jour à 12 h (Europe/Paris).
- Chaque mise à jour du catalogue republie le site GitHub Pages après la génération des pages.
- Les horaires GitHub Actions sont des heures cibles et peuvent être retardés.

Le dépôt étant public et les workflows utilisant `ubuntu-latest`, les runners standard GitHub Actions pour dépôts publics sont gratuits selon la documentation GitHub ([référence des runners](https://docs.github.com/fr/actions/reference/runners/github-hosted-runners)). GitHub Pages n'est toutefois pas destiné ni autorisé comme hébergement gratuit d'une activité en ligne, d'un site e-commerce ou d'un SaaS ([limites officielles de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). Si DRESSOPP devient principalement un service commercial, transactionnel ou SaaS, il faudra donc migrer vers un hébergement adapté avant cette évolution.

## Développement

- Site : https://sopp24.github.io/DRESSOPP/
- Prérequis pour les tests et le Worker : Node.js 22 (version utilisée dans les workflows GitHub Actions).
- Lancer localement : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000.
- Tests : `npm test` (vérifications de syntaxe JavaScript puis suite de tests Node.js).

### Structure

- `app.js` : interface, swipe, vues et chargement progressif.
- `modules/engine.js` : filtres, apprentissage et classement local.
- `modules/agent.js` : préparation et validation des recommandations IA.
- `modules/outfits.js` : extraction de signaux stylistiques des Pins et associations de tenues.
- `modules/store.js` : stockage local.
- `scripts/refresh-public-catalog.mjs` : collecte et pagination des produits publics autorisés.
- `scripts/sync-pinterest.mjs` : synchronisation Pinterest officielle.
- `data/merchant-directory.json` : répertoire éditorial des 200 enseignes.
- `data/public-sources.json` : paramètres de rotation (36 enseignes par exécution, dont 12 emplacements prioritaires).
- `data/catalog-seeds.json` : références produits éditoriales conservées lors des collectes.
- `data/catalog-manifest.json` et `data/catalog-pages/` : manifeste et pages du catalogue.
- `data/lookbook-pins.json` et `assets/lookbook/` : 20 références visuelles locales.
- `data/pinterest-pins.json` : instantané public Pinterest, actuellement non synchronisé.
- `workers/dressopp-agent/` : code du Worker Cloudflare du mode génératif.
- `docs/SOURCES.md`, `docs/AI-AGENT.md`, `docs/PINTEREST.md`, `docs/COMMUNITY.md` et `docs/DEPLOYMENT.md` : documentation technique détaillée.
- `.github/workflows/refresh-public-catalog.yml` : actualisation quotidienne du catalogue et déclenchement de Pages si les données changent.
- `.github/workflows/pinterest-daily.yml` : synchronisation Pinterest lorsque les secrets et autorisations sont configurés.
- `.github/workflows/deploy-pages.yml` : tests et déploiement GitHub Pages à chaque push sur `main` ou lancement manuel.
