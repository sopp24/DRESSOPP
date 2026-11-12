# Déploiement

Le workflow deploy-pages.yml lance les tests Node puis publie le site sur GitHub Pages à chaque push sur main.

Lors de la première publication, contrôler Settings > Pages > Build and deployment > Source : GitHub Actions.

URL attendue : https://sopp24.github.io/DRESSOPP/

## Worker Cloudflare — Personal shopper et classification Pinterest

Le code de `workers/dressopp-agent/src/index.js` doit être redéployé lorsque sa logique change. Depuis la racine du dépôt, dans un terminal authentifié sur Cloudflare :

```bash
npx wrangler deploy --config workers/dressopp-agent/wrangler.jsonc
```

Après le déploiement du Worker, lancer manuellement le workflow [Pinterest quotidien](../.github/workflows/pinterest-daily.yml) avec `workflow_dispatch`. La version d'analyse 3 relit les épingles dont l'analyse est encore en version 2 et détermine leur public (`men`, `women`, `unisex` ou `unknown`). Seules les références masculines confirmées sont affichées dans DRESSOPP.

Les identifiants Cloudflare et le secret Pinterest doivent rester dans leurs gestionnaires de secrets respectifs ; ne jamais les ajouter au dépôt.
