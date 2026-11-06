# Agent IA DRESSOPP — Personal shopper

L'agent IA est un classement conversationnel au-dessus du moteur de recommandation local. Il choisit et explique des fiches présentes dans le catalogue ; il n'invente pas d'articles et ne lance pas de crawl web libre. Le collecteur multi-boutiques continue de mettre à jour les produits.

## Déployer le service (optionnel, forfait gratuit)

1. Créer ou ouvrir un compte Cloudflare : https://dash.cloudflare.com/sign-up.
2. Garder le forfait **Workers Free**. Ne pas activer Workers Paid ni ajouter de moyen de paiement pour rester à 0 €.
3. Sur ton ordinateur, installer Node.js LTS puis ouvrir un terminal à la racine du dépôt cloné.
4. Exécuter :

```bash
cd workers/dressopp-agent
npx wrangler@latest login
npx wrangler@latest deploy
```

5. Autoriser Wrangler dans le navigateur. Le fichier `wrangler.jsonc` configure le binding Workers AI `AI` côté serveur.
6. À la fin, Wrangler affiche une URL du type `https://dressopp-agent.<ton-sous-domaine>.workers.dev`.
7. Dans `data/ai-agent-config.json`, renseigner cette URL dans `endpoint` et mettre `enabled` à `true`. Enregistrer le fichier sur `main`.
8. Après publication GitHub Pages, recharger DRESSOPP, ouvrir Découvrir, lire l'information sur les données transmises, cocher le consentement et lancer l'agent.

## Tester le service

Remplacer l'URL par celle de ton Worker :

```bash
curl -i -H 'Origin: https://sopp24.github.io' https://dressopp-agent.<ton-sous-domaine>.workers.dev/health
```

La réponse doit contenir `"ok":true` et l'identifiant du modèle.

## Coût et limites

- Workers AI fournit actuellement une allocation gratuite de **10 000 Neurons par jour** sur Workers Free. Elle se réinitialise chaque jour à 00:00 UTC. Si le quota quotidien est épuisé, les inférences gratuites échouent jusqu'au prochain cycle ; elles ne basculent pas automatiquement sur une facturation. Ne pas passer au forfait Workers Paid si tu veux garder un coût nul.
- Workers Free a également des plafonds de requêtes. Le Worker limite les requêtes rapprochées et chaque demande à 50 fiches / 48 Ko.
- Le modèle configuré est `@cf/google/gemma-4-26b-a4b-it`. Cloudflare le référence comme modèle d'inférence avec Zero Data Retention ; les données sont toutefois envoyées à Cloudflare pour traitement.
- L'agent travaille sur les fiches déjà disponibles dans DRESSOPP. Il classe au maximum 50 candidats et ne fait pas de recherche Internet autonome. Les `searchHints` sont des idées de recherche stylistique, pas des produits trouvés.
- Si le service n'est pas configuré, si le quota est dépassé ou si Cloudflare est indisponible, le moteur local continue de recommander les produits sans IA.

## Données envoyées (uniquement après consentement)

Le navigateur transmet les filtres choisis (catégorie, style, saison, budget), les préférences générales (styles, marques, couleurs, matières, coupes), un résumé des 15 derniers articles aimés / enregistrés / refusés, les tags et titres d'inspirations, les caractéristiques d'au plus 50 produits candidats (nom, marque, marchand, prix, catégorie, style, couleurs, matières, coupe, description courte).

Les tailles exactes, notes libres, e-mail, URL des produits, images, URL Pinterest et historique complet de navigation ne sont pas transmis. Les inspirations visuelles sont décrites au modèle uniquement par leurs titres et tags, pas par analyse des pixels ; le Worker ne télécharge pas d'images Pinterest ou marchandes. Le Worker ne journalise pas le corps des demandes. Les réponses sont filtrées : seul un identifiant déjà présent dans les candidats peut être renvoyé. Le consentement est facultatif et peut être retiré dans DRESSOPP ; sans consentement, seul le moteur local est utilisé.

## Pourquoi un service séparé ?

GitHub Pages distribue du JavaScript public : une clé privée placée dans `app.js` serait visible par tous. Le Worker conserve le binding IA côté serveur ; le dépôt ne contient ni clé de modèle ni secret Cloudflare.
