# Pinterest dans DRESSOPP

Le seul canal d'inspiration de DRESSOPP est le tableau :

https://fr.pinterest.com/sopppx24/mode/

## Synchronisation quotidienne

Le workflow `.github/workflows/pinterest-daily.yml` est prévu pour se lancer chaque jour à 12 h, fuseau `Europe/Paris`. Il peut également être déclenché manuellement depuis Actions.

Il utilise l'API Pinterest officielle v5 :
- `GET /boards` pour retrouver le tableau `mode` ;
- `GET /boards/{board_id}/pins` pour charger ses épingles ;
- comparaison des identifiants avec le dernier flux pour repérer les nouveaux Pins.

Le script s'arrête volontairement si Pinterest ne confirme pas que le tableau est **PUBLIC**. Le dépôt DRESSOPP étant public, le flux `data/pinterest-pins.json` est public lui aussi. Ne jamais utiliser ce mécanisme pour un tableau secret ou protégé.

## Activation

1. Crée une application dans le portail développeur Pinterest : https://developers.pinterest.com/
2. Crée l'application en étant connecté au compte Pinterest qui possède le tableau.
3. Crée l'application en étant connecté au même compte Pinterest que celui qui possède le tableau `sopppx24/mode`. Le flux Client Credentials agit au nom du propriétaire de l'application : les deux comptes doivent donc correspondre.
4. Active la double authentification Pinterest et configure l'accès API v5 avec les permissions minimales `boards:read` et `pins:read`.
5. Dans GitHub, ouvre **Settings → Secrets and variables → Actions → New repository secret** et ajoute :
   - `PINTEREST_APP_ID` : l'ID de ton application Pinterest ;
   - `PINTEREST_APP_SECRET` : le secret de ton application.
6. Le workflow génère un jeton OAuth court à chaque synchronisation avec le flux `client_credentials`. Aucun jeton d'accès réutilisable n'a besoin d'être enregistré.
7. En alternative, tu peux fournir un secret `PINTEREST_ACCESS_TOKEN` déjà généré ; il sera prioritaire, mais il expirera et devra être renouvelé manuellement.
8. Ouvre l'onglet **Actions**, puis le workflow **DRESSOPP — Synchronisation Pinterest quotidienne** et lance **Run workflow** pour le premier test.

Si le tableau est secret, l'API requiert les scopes adaptés (`boards:read_secret` et `pins:read_secret`) et les données doivent être stockées dans un dépôt privé ou un backend privé. Le script actuel refuse de publier ce tableau dans le dépôt public.

## Données de synchronisation

`data/pinterest-pins.json` contient la liste courante des épingles récupérées, leurs identifiants, liens, descriptions, dates et images Pinterest, ainsi que les identifiants nouveaux au dernier passage.

DRESSOPP peut alors distinguer les Pins déjà consultés dans l'application de ceux qui viennent d'arriver. Les interactions « Oui », « Non » et « Ajouter à ma liste » restent enregistrées localement dans IndexedDB.

## Limites

- Pinterest doit autoriser l'application développeur et le token doit rester valide.
- La synchronisation programmée dépend de GitHub Actions ; un horaire cron est une heure cible, pas une garantie d'exécution à la seconde près.
- Le premier lancement récupère les épingles du tableau ; les suivantes comparent les identifiants au flux précédent.
