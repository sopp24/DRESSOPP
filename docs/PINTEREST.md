# Pinterest dans DRESSOPP

## Priorité stylistique

Le tableau de référence est :

https://fr.pinterest.com/sopppx24/mode/

Pinterest est une source d'inspiration prioritaire, pas un catalogue commercial. Le tableau peut contenir des images d'autres sujets ; le moteur ne retient que les signaux interprétables (styles, couleurs, matières, coupes, motifs et tags) pour construire les préférences. Les Pins ne doivent jamais être convertis automatiquement en fiches marchandes, prix ou liens produit inventés.

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
5. Le workflow génère un jeton Client Credentials pour les endpoints autorisés. Ce mode agit au nom de l'application et non d'un utilisateur tiers ; il ne donne pas accès à toutes les ressources d'un compte.
6. Un secret `PINTEREST_ACCESS_TOKEN` peut être utilisé à la place. Pour des ressources utilisateur qui nécessitent un consentement, il faut le flux OAuth Authorization Code et les scopes correspondants.
7. Lancer [Actions → Synchronisation Pinterest](https://github.com/sopp24/DRESSOPP/actions/workflows/pinterest-daily.yml) pour vérifier le premier passage.

Les scopes secrets `boards:read_secret` et `pins:read_secret` ne doivent être utilisés que dans un flux OAuth utilisateur qui a obtenu ce consentement. Le mécanisme public actuel refuse de publier les Pins secrets. Pour une utilisation future de tableaux privés, les données devront être stockées dans un backend privé et non dans ce dépôt public.

## Données et confidentialité

`data/pinterest-pins.json` contient les Pins publics synchronisés, leurs identifiants, liens, titres/descriptions et images. Les interactions et feedbacks personnels restent dans IndexedDB sur l'appareil. Les identifiants ou mots de passe Pinterest ne doivent jamais être committés dans le dépôt.

## Limites

- L'application Pinterest et les autorisations API doivent être valides.
- Les pages du tableau doivent être publiques pour le workflow actuel.
- Le client credentials ne remplace pas un consentement utilisateur pour des ressources privées.
- Les horaires cron GitHub Actions sont des heures cibles et peuvent être retardés.
- Le premier passage charge les Pins accessibles ; les suivants identifient les nouveaux Pins.
