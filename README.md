# DRESSOPP

**Find your style. Build your identity.**

DRESSOPP associe la découverte de vêtements par décisions rapides, une garde-robe personnelle, un moteur d'apprentissage et un espace de tenues inspirées d'un tableau Pinterest unique.

## Expérience

- **Découvrir** : une pièce à la fois, gestes tactiles/souris et navigation clavier.
- **Non** à gauche : signal négatif pour le moteur.
- **Oui** à droite : signal positif pour le moteur, sans sauvegarde automatique dans la liste.
- **Ajouter à ma liste** au centre : sauvegarde dans la garde-robe sans le confondre avec un vote.
- **Annulation** de la dernière décision (Oui, Non ou ajout à la liste).
- **Entraînement** : découverte prioritaire avec le même système de votes.
- **Ma garde-robe** : recherche, filtres, tri et retrait d'un article sans créer de Non.
- **Pinterest** : le tableau `sopppx24/mode` est l'unique source d'inspiration.
- **Tenues** : rapproche les Pins des pièces enregistrées et propose des compléments uniquement lorsqu'une fiche produit vérifiable existe dans le catalogue.
- **Profil** : tailles et préférences facultatives.
- Import de produits, export/import JSON et stockage local IndexedDB avec repli localStorage.

Le moteur apprend des réponses Oui/Non, de tes préférences déclarées et des mots-clés détectables dans les métadonnées des Pins. Cette version ne fait pas d'analyse visuelle IA des photographies : les rapprochements de tenues se basent sur les titres, descriptions, textes alternatifs, tags et attributs des fiches produits.

## Pinterest : synchronisation quotidienne

Le workflow `.github/workflows/pinterest-daily.yml` est prévu pour s'exécuter chaque jour à **12 h, fuseau Europe/Paris**, via l'API Pinterest v5.

La synchronisation n'est pas encore active tant que le secret n'a pas été ajouté. Procédure complète dans [docs/PINTEREST.md](docs/PINTEREST.md).

- Secrets recommandés : `PINTEREST_APP_ID` et `PINTEREST_APP_SECRET` (jeton renouvelé à chaque exécution).
- Permissions minimales : `boards:read` et `pins:read` pour un tableau public.
- Le script retrouve le tableau nommé `mode`, récupère ses Pins, compare leurs identifiants avec le dernier passage et met à jour `data/pinterest-pins.json`.
- Le script refuse de copier un tableau qui n'est pas explicitement public dans ce dépôt public.
- Lorsqu'un flux change, le workflow déclenche aussi `deploy-pages.yml` pour publier les nouvelles épingles sur le site. Aucun déploiement redondant n'est lancé si le JSON est inchangé.
- Le flux est visible publiquement dans le repository. Ne configure pas le secret pour un tableau secret/protégé ; une destination privée est nécessaire dans ce cas.

L'horaire est une cible planifiée GitHub Actions ; l'exécution peut être retardée par la disponibilité de la plateforme.

## Déploiement Pages

Le workflow `.github/workflows/deploy-pages.yml` lance les tests puis publie GitHub Pages sur chaque push. Le workflow Pinterest le déclenche également après une mise à jour effective du flux. La source Pages doit être **GitHub Actions** dans **Settings → Pages → Build and deployment**.

Adresse du site : https://sopp24.github.io/DRESSOPP/

## Lancer en local

Aucune dépendance externe n'est nécessaire pour l'application.

~~~bash
python3 -m http.server 8000
~~~

Puis ouvrir http://localhost:8000.

Tests :

~~~bash
npm test
~~~

## Données et confidentialité

Les préférences, votes Oui/Non, articles enregistrés et Pins parcourus sont conservés dans IndexedDB sur cet appareil. L'export JSON permet de sauvegarder et transférer ces données manuellement.

Le dépôt est public : aucun token, historique personnel, liste de favoris ou profil n'y est écrit. Le flux `data/pinterest-pins.json` est le seul contenu Pinterest publié, et uniquement si l'API confirme que le tableau est public.

## Logo

- `assets/logo-square.png` est utilisé dans l'en-tête, comme favicon du navigateur, dans le manifeste PWA et comme icône de raccourci mobile (Apple Touch Icon).
- Le même PNG est inclus dans le cache hors ligne de l'application.

Le dépôt ne contient plus de favicon SVG de remplacement.

## Structure

- `index.html` — shell de l'application et navigation.
- `styles.css` — direction artistique et responsive.
- `app.js` — navigation, décisions, sauvegarde et vues.
- `modules/engine.js` — normalisation, filtres et classement.
- `modules/outfits.js` — analyse textuelle légère des Pins et génération des compositions.
- `modules/store.js` — stockage local.
- `modules/integrations.js` — configuration Pinterest.
- `scripts/sync-pinterest.mjs` — synchronisation API Pinterest v5.
- `data/pinterest-pins.json` — flux Pinterest public.
- `tests/` — tests unitaires.
- `.github/workflows/deploy-pages.yml` — déploiement du site.
- `.github/workflows/pinterest-daily.yml` — synchronisation Pinterest quotidienne.


## Catalogue multi-boutiques

DRESSOPP peut alimenter le swipe depuis les flux produits Awin accessibles au compte éditeur. Le connecteur met à jour les fiches six fois par jour, ne télécharge que les flux modifiés et écarte les articles expirés, sans prix EUR, lien, photo ou stock positif. Le moteur classe les articles en temps réel selon les votes, le lookbook, les préférences, les tailles et le budget ; la fraîcheur du stock et des prix dépend de la dernière mise à jour du flux. Les notes d'articles restent distinctes de la réputation du marchand, qui n'est prise en compte que si la source la fournit explicitement.

Pour activer les flux, ajouter le secret GitHub Actions `AWIN_PRODUCT_FEED_LIST_URL` avec le lien complet de liste obtenu dans Awin → Boîte à outils → Créer un flux. Voir [le guide Awin](docs/AWIN.md). Sans ce secret, les trois références de départ expirent le 12 novembre 2026 et les autres boutiques restent accessibles depuis Découvrir par liens officiels.
