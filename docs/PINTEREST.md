# Pinterest dans DRESSOPP

## Priorité stylistique

Le tableau de référence est :

https://fr.pinterest.com/sopppx24/mode/

Pinterest est une source d'inspiration prioritaire, pas un catalogue commercial. DRESSOPP ne conserve dans les recommandations que les références de mode masculine confirmées. Les Pins féminins, mixtes/unisexes, ambigus ou non vestimentaires sont exclus des inspirations et des compositions de tenues. Les signaux retenus (styles, couleurs, matières, coupes, motifs et détails) construisent les préférences ; les Pins ne sont jamais convertis automatiquement en fiches marchandes, prix ou liens produit inventés.

Le moteur accorde davantage de poids aux signaux stylistiques Pinterest. Les réponses Oui/Non sur les produits et le feedback sur les tenues peuvent ensuite corriger ou confirmer ces inspirations.

## Synchronisation

Le workflow `.github/workflows/pinterest-daily.yml` est prévu chaque jour à 12 h (Europe/Paris) et peut être lancé depuis GitHub Actions.

Il utilise Pinterest API v5 :
- `GET /boards` pour retrouver le tableau `mode` ;
- `GET /boards/{board_id}/pins` pour lire les Pins ;
- comparaison des identifiants pour repérer les nouvelles épingles.

Le script actuel n'écrit dans `data/pinterest-pins.json` que si l'API confirme que le tableau est **PUBLIC**. Le dépôt DRESSOPP est public ; le fichier publié est donc public également. Aucun tableau secret ou contenu privé ne doit y être publié.

## Activation avec l'application Pinterest

1. Créer une application dans le portail développeur : https://developers.pinterest.com/
2. Utiliser le compte Pinterest qui possède le tableau `sopppx24/mode`.
3. Configurer les autorisations minimales `boards:read` et `pins:read`.
4. Dans GitHub, ouvrir **Settings → Secrets and variables → Actions → New repository secret** et ajouter :
   - `PINTEREST_APP_ID` : identifiant de l'application ;
   - `PINTEREST_APP_SECRET` : secret de l'application.
5. Générer un jeton privé avec `openssl rand -hex 32`. Dans un terminal, depuis le dossier `workers/dressopp-agent`, le configurer côté Cloudflare puis redéployer le Worker :
   ```bash
   npx wrangler secret put PINTEREST_SYNC_TOKEN
   npx wrangler deploy
   ```
   Lorsque Cloudflare demande une valeur, coller le jeton généré.
6. Dans GitHub, ouvrir **Settings → Secrets and variables → Actions → New repository secret**, nommer ce secret `PINTEREST_SYNC_TOKEN` et coller exactement le même jeton.
7. Le workflow génère un jeton Client Credentials pour les endpoints autorisés. Ce mode agit au nom de l'application et non d'un utilisateur tiers ; il ne donne pas accès à toutes les ressources d'un compte.
8. Un secret `PINTEREST_ACCESS_TOKEN` peut être utilisé à la place. Pour des ressources utilisateur qui nécessitent un consentement, il faut le flux OAuth Authorization Code et les scopes correspondants.
9. Lancer [Actions → Synchronisation Pinterest](https://github.com/sopp24/DRESSOPP/actions/workflows/pinterest-daily.yml) pour vérifier le premier passage.

Les scopes secrets `boards:read_secret` et `pins:read_secret` ne doivent être utilisés que dans un flux OAuth utilisateur qui a obtenu ce consentement. Le mécanisme public actuel refuse de publier les Pins secrets. Pour une utilisation future de tableaux privés, les données devront être stockées dans un backend privé et non dans ce dépôt public.

## Analyse visuelle automatique

Après la synchronisation Pinterest, le workflow transmet au Worker Cloudflare les images qui n'ont pas encore été analysées avec la version courante du schéma ou dont l'URL a changé. Le Worker utilise le modèle Gemma 4 avec sa capacité de vision. Les images sont récupérées uniquement depuis `i.pinimg.com`, puis analysées côté serveur.

La version 3 de `visualAnalysis` décrit les styles, couleurs, matières, coupes et motifs, mais aussi les pièces identifiables une par une (type, couleur, matière, coupe, motif et détails), les détails de construction, la silhouette générale, les associations de couleurs, les superpositions, les saisons et les contextes d'usage possibles. Les champs incertains sont laissés vides plutôt que déduits. Un résumé et une formule de tenue synthétisent les éléments visibles.

Ces informations techniques alimentent le moteur de correspondance des tenues : les types de pièces et les détails visibles servent à rapprocher les inspirations des fiches du catalogue, et les saisons explicites peuvent affiner les filtres. Elles ne sont pas affichées dans les cartes, les tags visibles ou les paramètres de l'application. Une hausse de version du schéma déclenche une nouvelle analyse des Pins existants, même lorsque leur image n'a pas changé.

L’analyse est facultative tant que `PINTEREST_SYNC_TOKEN` n’est pas configuré : la synchronisation classique continue et les images non analysées seront retentées lors d’un prochain passage. Une image inaccessible ou non vestimentaire n’interrompt pas le reste du flux.

## Données et confidentialité

`data/pinterest-pins.json` contient les Pins publics synchronisés, leurs identifiants, liens, titres/descriptions, images et métadonnées d’analyse visuelle. Le dépôt étant public, ces métadonnées techniques le sont également ; seules les images du tableau explicitement public sont traitées. Les interactions et feedbacks personnels restent dans IndexedDB sur l'appareil. Les identifiants ou mots de passe Pinterest ne doivent jamais être committés dans le dépôt.

## Limites

- L'application Pinterest et les autorisations API doivent être valides.
- Les pages du tableau doivent être publiques pour le workflow actuel.
- Le client credentials ne remplace pas un consentement utilisateur pour des ressources privées.
- Les horaires cron GitHub Actions sont des heures cibles et peuvent être retardés.
- Le premier passage charge les Pins accessibles ; les suivants identifient les nouveaux Pins et analysent uniquement les images qui ne possèdent pas encore de résultat valide.
