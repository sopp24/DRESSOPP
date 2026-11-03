# DRESSOPP

**Find your style. Build your identity.**

DRESSOPP est une application personnelle de découverte vestimentaire qui combine une interface de swipe avec un catalogue e-commerce, une garde-robe, un mode Entraînement, un profil de style et un espace Inspirations.

## Fonctionnalités livrées

- Découverte en cartes ou en grille, swipe tactile/souris et raccourcis clavier.
- Like, dislike et annulation de la dernière action.
- Filtres cumulables : objectif, style, saison et plafond de prix.
- Classement adaptatif basé sur likes, dislikes et préférences déclarées.
- Garde-robe, recherche, tri et suppression d'un favori sans créer de dislike.
- Fiches produits et liens sortants vers le marchand.
- Ajout manuel de produits et import de catalogue JSON.
- Import manuel d'inspirations (lien, image, tags).
- Profil vestimentaire modifiable.
- Export/import de l'ensemble des données au format JSON.
- Stockage persistant local via IndexedDB, avec repli localStorage.
- Interface responsive et shell PWA installable.
- Tests unitaires de la normalisation, des filtres et du classement.

## Lancer en local

Le projet ne nécessite aucune dépendance externe.

~~~bash
python3 -m http.server 8000
~~~

Puis ouvrir http://localhost:8000.

Les tests se lancent avec :

~~~bash
npm test
~~~

## Déploiement GitHub Pages

Le workflow de déploiement exécute les tests puis publie le contenu de main.

Lors de la première publication, vérifier dans **Settings → Pages → Build and deployment** que la source est réglée sur **GitHub Actions**. Le site sera disponible à :

https://sopp24.github.io/DRESSOPP/

## Données et confidentialité

Le dépôt DRESSOPP est public. Les préférences, inspirations, favoris et historiques personnels ne sont donc **pas** écrits dans le dépôt. Ils sont conservés dans IndexedDB sur l'appareil, ce qui assure leur persistance sur ce navigateur mais ne synchronise pas automatiquement plusieurs appareils.

L'export JSON permet de sauvegarder et transférer les données manuellement. Une synchronisation GitHub multi-appareils nécessite un backend privé (ou une fonction serveur) et un dépôt de données privé. Aucun token personnel GitHub n'est embarqué dans le JavaScript public.

## Intégrations externes — état réel

- **Pinterest :** import manuel de liens et d'images disponible. OAuth n'est pas activé : le secret client et les jetons doivent être gérés côté serveur.
- **Zalando et autres marchands :** ajout manuel de fiches et import de catalogue JSON disponibles. Aucun catalogue partenaire/API n'est configuré dans ce dépôt.
- **Instagram :** import manuel de liens et d'images ; aucun accès automatique au fil publicitaire personnel.
- **Scraping :** aucun scraping ni contournement de restriction.

L'application n'invente ni disponibilité, ni prix, ni composition, ni note marchand. Le catalogue initial est vide tant que des produits vérifiables n'ont pas été importés.

## Logo

Le logo DRESSOPP définitif n'était pas présent dans le dépôt au moment de l'initialisation. L'interface utilise donc provisoirement un repère typographique et un favicon temporaire. Le logo original pourra être ajouté dans assets/ puis branché dans index.html et assets/favicon.svg sans changer l'interface.

## Structure

- index.html — shell de l'application.
- styles.css — identité visuelle et responsive.
- app.js — navigation et interactions.
- modules/engine.js — normalisation, filtres et moteur de recommandation.
- modules/store.js — persistance locale.
- modules/integrations.js — registre des connecteurs et état des intégrations.
- data/catalog.json — catalogue initial, volontairement vide.
- tests/engine.test.js — tests unitaires.
- .github/workflows/deploy-pages.yml — tests et déploiement GitHub Pages.
