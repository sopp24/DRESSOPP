# DRESSOPP

**Find your style. Build your identity.**

DRESSOPP est un personal shopper visuel pour la mode masculine et les marques mixtes : une expérience de découverte façon Tinder, nourrie par Pinterest, un catalogue multi-boutiques et un moteur qui apprend de chaque réponse Oui, Non et de chaque article sauvegardé.

Site : https://sopp24.github.io/DRESSOPP/

## Brief utilisateur — priorités permanentes

Cette section conserve la demande de référence pour faire évoluer les sources et les recommandations. Elle ne doit pas être remplacée par une simple liste de boutiques crawlables.

1. **Pinterest en priorité stylistique.** Tableau principal : https://fr.pinterest.com/sopppx24/mode/. Le tableau peut contenir autre chose que des vêtements ; ses images, titres, descriptions et tags sont des inspirations de goût, avec une majorité de références vestimentaires. L'algorithme doit en extraire les styles, couleurs, matières, coupes et associations sans considérer chaque Pin comme une fiche produit.
2. **Zalando en priorité commerciale.** Utiliser en priorité les articles et marques disponibles sur Zalando. L'accès à une wishlist ou à un compte client personnel n'est pas fourni par l'API catalogue partenaire. Aucun mot de passe ne doit être demandé ou stocké. Une liste personnelle peut être intégrée par export/import ou par un connecteur officiel autorisé si Zalando en propose un pour cet usage.
3. **Adapter les propositions au style, à la catégorie et au budget.** Les univers prioritaires comprennent les multimarques (Zalando, ASOS, UNIQLO…), l'accessible/casual (BZB, Pull & Bear…), le premium et le luxe (Louis Vuitton, Dior, Lothaire…), les sneakers et le sport (Nike, adidas, Courir…) et les sous-vêtements (Calvin Klein, Undiz…).
4. **Fiabilité des marchands.** Prendre en compte Trustpilot, Google Avis clients, Avis Vérifiés, Trusted Shops et Custplace uniquement lorsque les notes sont disponibles par une API ou une source autorisée et vérifiable. Ne pas confondre une note de produit avec la fiabilité du marchand, ni inventer ou extrapoler une note.
5. **Publicités mode.** Les publicités publiques pertinentes (notamment via Meta Ad Library) peuvent être un signal de tendance complémentaire. Elles ne donnent pas accès au fil Instagram personnalisé de l'utilisateur et ne prouvent pas qu'un produit est apprécié personnellement.
6. **Couverture internationale.** Le répertoire comprend 200 enseignes pour homme ou mixtes, dans les mêmes univers que les références fournies. Les pays, devises, livraison et accès techniques varient selon les enseignes.

## Expérience de découverte en flux continu

- Une pièce à la fois en mode swipe, ou une grille.
- Glisser à gauche / **Non** : préférence négative ; glisser à droite / **Oui** : intérêt ; **Ajouter à ma liste** : sauvegarde.
- Les articles déjà évalués ou sauvegardés ne reviennent pas dans le flux normal.
- Le moteur local classe les produits selon les préférences apprises, le profil, les tailles, les marques, les couleurs, matières, coupes, le style, le budget, la saison et la fraîcheur des fiches.
- Le catalogue est découpé en pages de 120 produits. Le site charge la première page, puis précharge la suivante quand il reste environ huit propositions à découvrir. En mode grille, le prochain lot se charge aussi au défilement.
- Quand toutes les pages publiées ont été parcourues, le site vérifie périodiquement si un nouveau manifeste est disponible. Une nouvelle collecte peut donc être consommée sans recharger manuellement l'application.
- Le workflow catalogue explore **36 enseignes par jour** parmi les 200, dont 12 priorités hautes et 24 sources en rotation. Les curseurs de rotation sont conservés dans `data/catalog-meta.json`.
- Ce fonctionnement supprime la limite artificielle de swipes. Il ne promet pas une infinité mathématique de vêtements : le volume réel dépend des produits que les sources publient, de leurs accès autorisés et de la disponibilité des articles.

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

## Un agent IA ne suffit pas — architecture retenue

L'agent IA est le cerveau de recommandation, pas le collecteur de produits :
- il comprend les goûts et les retours Oui/Non ;
- il peut classer et expliquer jusqu'à 50 produits déjà présents dans le catalogue ;
- il ne crée pas de fausses fiches et ne parcourt pas de lui-même les 200 boutiques ;
- les collecteurs et connecteurs fournissent les produits réels, l'agent décide lesquels montrer en premier ;
- si l'agent est indisponible ou si son quota est atteint, le classement local continue.

Le Worker utilise Cloudflare Workers AI et le modèle `@cf/google/gemma-4-26b-a4b-it`. L'envoi de préférences à ce service est soumis au consentement dans DRESSOPP. Les tailles et données personnelles non nécessaires ne doivent pas être transmises.

## Pinterest — source stylistique prioritaire

Le tableau `sopppx24/mode` est la référence d'inspiration. Le workflow `.github/workflows/pinterest-daily.yml` synchronise le tableau via Pinterest API v5 lorsque l'application et les secrets sont configurés. Le tableau doit être public pour le mécanisme de publication actuel dans ce dépôt public. Les tableaux secrets nécessitent une autorisation utilisateur adaptée et un stockage privé : ne jamais publier des Pins privés dans ce dépôt.

La synchronisation utilise `boards:read` et `pins:read`. Pour connecter l'application, il faut configurer l'application Pinterest et les secrets GitHub décrits dans [`docs/PINTEREST.md`](./docs/PINTEREST.md). Aucune connexion active ne doit être annoncée tant que le flux confirme `privacy: PUBLIC` et contient les Pins.

## Zalando et comptes personnels

Zalando est une source prioritaire du répertoire, mais l'API partenaire de catalogue n'est pas une API de lecture des comptes clients et de leurs favoris. DRESSOPP ne doit jamais demander le mot de passe Zalando, automatiser une connexion en contournant les protections ou prétendre avoir accès à une wishlist qui n'a pas été fournie. Un export/import d'articles ou un accès officiel expressément autorisé est préférable.

## Avis marchands, popularité et publicités

Les plateformes citées dans le brief (Trustpilot, Google Avis clients, Avis Vérifiés, Trusted Shops, Custplace) ne constituent pas un flux libre et universel. Une donnée de réputation n'est utilisable que si son origine, sa date, sa portée et les droits d'accès sont vérifiables. La réputation du marchand et la note d'un produit sont conservées séparément.

Meta Ad Library peut aider à analyser certaines publicités publiques, mais ne permet pas de reconstruire le fil publicitaire personnalisé d'un compte Instagram. Une publicité est un signal de visibilité, pas une preuve de qualité, de stock ou de préférence personnelle.

## Vie privée et données

Les profils, tailles, votes, préférences, garde-robe et interactions restent localement dans IndexedDB avec un repli localStorage. Le dépôt est public : seules les données de sources publiques doivent y être publiées. Aucun identifiant Zalando ou mot de passe ne doit être ajouté au dépôt. La synchronisation Pinterest publique ne doit contenir que le tableau confirmé public. Le partage communautaire et les transferts IA sont facultatifs.

## Automatisations GitHub

- Catalogue : [workflow catalogue](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml), planifié chaque jour à 08 h 17 (Europe/Paris).
- Pinterest : [workflow Pinterest](https://github.com/sopp24/DRESSOPP/actions/workflows/pinterest-daily.yml), planifié chaque jour à 12 h (Europe/Paris).
- Chaque mise à jour du catalogue republie le site GitHub Pages après la génération des pages.
- Les horaires GitHub Actions sont des heures cibles et peuvent être retardés.

Le runner standard des dépôts publics est proposé sans frais selon les conditions GitHub. GitHub Pages a toutefois des restrictions et n'est pas conçu comme hébergement gratuit d'une activité commerciale, d'un e-commerce ou d'un SaaS. Si DRESSOPP devient un service commercial, l'hébergement devra être réévalué.

## Développement

- Site : https://sopp24.github.io/DRESSOPP/
- Lancer localement : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000.
- Tests : `npm test`.

### Structure

- `app.js` : interface, swipe, vues et chargement progressif.
- `modules/engine.js` : filtres, apprentissage et classement local.
- `modules/agent.js` : préparation et validation des recommandations IA.
- `modules/outfits.js` : extraction de signaux stylistiques des Pins et associations de tenues.
- `modules/store.js` : stockage local.
- `scripts/refresh-public-catalog.mjs` : collecte et pagination des produits publics autorisés.
- `scripts/sync-pinterest.mjs` : synchronisation Pinterest officielle.
- `data/merchant-directory.json` : répertoire éditorial des 200 enseignes.
- `data/public-sources.json` : paramètres de rotation du collecteur.
- `.github/workflows/refresh-public-catalog.yml` : actualisation quotidienne et déploiement Pages.
- `.github/workflows/pinterest-daily.yml` : synchronisation Pinterest.
