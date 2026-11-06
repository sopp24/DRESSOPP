# Catalogue gratuit multi-sources

## Principe

DRESSOPP ne dépend plus d'un réseau d'affiliation ni d'une API Shopping payante. GitHub Actions exécute `scripts/refresh-public-catalog.mjs` chaque jour. La liste de départ de près de 50 enseignes est dans `data/public-sources.json` et peut être enrichie en ajoutant un nom et le domaine officiel.

## Sources de départ

| Famille | Boutiques |
|---|---|
| Multimarques | Zalando, ASOS, ABOUT YOU, La Redoute |
| Accessible et casual | UNIQLO, Zara, BZB, Pull & Bear, Bershka, H&M, Mango, Celio, Jules, Kiabi, C&A, Weekday |
| Premium et créateurs | COS, ARKET, Massimo Dutti, Charles Tyrwhitt, Lacoste, Fred Perry, Tommy Hilfiger, Polo Ralph Lauren, Lothaire |
| Luxe | Louis Vuitton, Dior, 24S |
| Sneakers et sport | Nike, adidas, New Balance, Puma, ASICS, Converse, Courir, JD Sports, Foot Locker, Snipes, Decathlon |
| Chaussures et accessoires | Sarenza, Spartoo |
| Seconde main | Vestiaire Collective |
| Sous-vêtements | Calvin Klein, Undiz |
| Autres | Levi's, Carhartt WIP, Jack & Jones, Galeries Lafayette, Printemps |

La présence d'une enseigne dans cette liste ne garantit pas qu'elle accepte l'exploration automatique. La liste est un répertoire de départ, pas une promesse de disponibilité.

## Coût et hébergement

- Le collecteur n'utilise aucune API Shopping payante, aucun compte éditeur et aucun abonnement.
- GitHub indique que l'utilisation des runners standard GitHub Actions est gratuite pour les dépôts publics : [tarifs GitHub](https://github.com/pricing).
- GitHub Pages est disponible avec GitHub Free pour les dépôts publics : [documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages).
- **Limite importante :** GitHub précise que Pages n'est pas un hébergement gratuit destiné à une activité commerciale, un e-commerce ou un SaaS. DRESSOPP n'encaisse pas d'argent et ne traite aucune transaction. Si le projet devient commercial, il faudra reconsidérer son hébergement : [limites GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Ce que le collecteur fait

1. Lit `robots.txt` et utilise les sitemaps annoncés par le site.
2. Si un sitemap n'est pas annoncé, tente les chemins standard `/sitemap.xml` et `/sitemap_index.xml`.
3. Visite la page d'accueil et, au maximum, deux catégories pertinentes.
4. Limite le nombre de pages candidates et ralentit les requêtes par domaine.
5. Extrait les fiches Schema.org `Product` et `Offer`, ou les métadonnées Open Graph de secours.
6. Requiert au minimum un nom, un prix en EUR, une URL produit HTTPS et une image HTTPS.
7. Enregistre une date de vérification. Une fiche publique non revérifiée après sept jours devient périmée et sort de la découverte.
8. Déduplique les URL et conserve les références éditoriales existantes.

Le robot s'identifie comme DRESSOPPBot. Il respecte les règles robots et ne contourne ni CAPTCHA, ni authentification, ni blocage HTTP 401/403/429.

**Respecter robots.txt ne vaut pas licence de réutilisation.** Les conditions des boutiques et les droits applicables aux descriptions, marques et images restent à respecter. Le collecteur ne télécharge pas les images ; il conserve leur URL publique pour afficher le lien vers la fiche marchande. Une boutique ou un titulaire de droits peut demander le retrait d'une source ou d'une fiche.

## Limites à connaître

- Une page sans balisage produit exploitable ne sera pas importée, même si un humain peut la consulter.
- Certains sites utilisent du rendu JavaScript, des API privées ou des protections anti-robots. Ils ne seront pas contournés.
- Le crawl est un échantillonnage borné, pas l'indexation complète de toutes les tailles et variantes d'une boutique.
- Le prix et l'état du stock reflètent le dernier contrôle. La fiche marchande reste la référence avant achat.
- Google Shopping, les recommandations d'achat privées, le fil Instagram personnalisé et les comptes Zalando personnels ne sont pas accessibles par magie depuis un site statique.
- Pour les boutiques qui ne livrent pas de données publiques exploitables, les liens officiels restent disponibles dans la rubrique Découvrir. Une fiche peut aussi être importée manuellement au format JSON.

## Lancer le workflow

Ouvrir [Actions → Catalogue public multi-sources](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml), puis **Run workflow**. Le traitement se relance ensuite automatiquement chaque jour à 08 h 17 (heure de Paris). GitHub peut retarder les exécutions programmées.

Le compte-rendu par boutique apparaît dans les logs du job ; le résultat détaillé est publié dans `data/catalog-meta.json`.

## Ajouter une boutique

Dans `data/public-sources.json`, ajouter une entrée de ce type :

```json
{ "name": "Nom de la boutique", "domain": "boutique.fr" }
```

Utiliser le domaine officiel sans protocole ni chemin. Ne pas ajouter de domaine tiers utilisé uniquement pour contourner un blocage.
