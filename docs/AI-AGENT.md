# Agent IA DRESSOPP — Personal shopper

DRESSOPP possède désormais un agent utilisable dès l'ouverture, sans déployer de service et sans accepter de transfert de données. La sélection reste masculine : seuls les produits confirmés pour homme, ou unisexes et adaptés à un homme (champ `menFit`), entrent dans le classement local ou distant ; les fiches femme, les pièces typiquement féminines et les fiches de public inconnu sont exclues. Après mise à jour du code, redéployer le Worker (`npx wrangler deploy`) pour qu'il accepte `menFit`.

## Mode local — activé par défaut

Le personal shopper local fonctionne directement dans le navigateur :
- croise les filtres, le profil, les favoris, les réponses Oui/Non et les titres/tags Pinterest disponibles ;
- repère les correspondances de style, couleurs, matières, coupes et marques ;
- classe les produits déjà présents dans le catalogue, avec une pénalité de répétition des mêmes marchands et catégories ;
- explique brièvement chaque recommandation à partir des attributs réellement présents sur la fiche ;
- ne crée jamais de produits ou de prix fictifs.

Aucune donnée n'est envoyée au réseau dans ce mode. Aucun compte, secret, endpoint ou consentement n'est nécessaire. Le classement local normal continue de fonctionner si le personal shopper ne peut pas analyser les candidats.

## Mode génératif Cloudflare — facultatif

DRESSOPP peut aussi utiliser le modèle Cloudflare Workers AI configuré par `data/ai-agent-config.json`. Le modèle actuel est `@cf/google/gemma-4-26b-a4b-it`, fourni via le binding serveur `env.AI`. Le navigateur ne contient aucune clé privée.

Pour utiliser ce mode, l'utilisateur doit activer explicitement la case d'autorisation dans le panneau du personal shopper. Sans cette case, aucune requête `/recommend` n'est envoyée. Si le Worker ou le modèle est indisponible, l'agent bascule sur le mode local au lieu de masquer le bouton ou de désactiver le personal shopper.

Le service Worker est déjà présent dans `workers/dressopp-agent/`. Il peut être déployé sur un compte Cloudflare avec :

```bash
cd workers/dressopp-agent
npx wrangler@latest login
npx wrangler@latest deploy
```

L'URL publique du Worker est conservée dans `data/ai-agent-config.json`. Le déploiement ou la modification des secrets Cloudflare nécessite l'autorisation du propriétaire du compte ; aucune clé n'est stockée dans ce dépôt.

## Données transférées en mode Cloudflare

Après consentement uniquement, le navigateur peut transmettre les filtres choisis, les préférences générales, un résumé limité des derniers retours et les attributs de 50 fiches maximum. Les tailles exactes, notes privées, e-mail, URL produits et images ne sont pas transmis. Les recommandations renvoyées sont validées contre les identifiants exacts des produits envoyés.

Le consentement peut être retiré à tout moment. Après retrait, le mode local reste entièrement fonctionnel.

## Tests

`npm test` vérifie notamment :
- l'absence d'envoi de données personnelles dans le payload distant ;
- les limites du Worker ;
- la sélection locale sans endpoint ;
- la prise en compte des votes positifs/négatifs et des préférences.
