# Connecter les catalogues marchands à DRESSOPP

## Ce qui est automatisé

DRESSOPP utilise les flux produits Awin quand un marchand les met à disposition du compte éditeur et que le compte a le droit de les télécharger. Le connecteur sélectionne les enseignes demandées lorsqu'elles apparaissent dans la liste de flux française : Zalando, ASOS, UNIQLO, BZB, Pull & Bear, Nike, adidas, Courir, Calvin Klein, Undiz, Louis Vuitton, Dior et Lothaire.

Les fiches intégrées doivent comporter un nom, un prix en EUR, un lien produit HTTPS, une image HTTPS et un état de stock positif. Les fiches en rupture, expirées, sans prix ou sans image sont écartées. Les attributs couleur, matière, taille, coupe et motif sont transmis au moteur quand le flux les fournit.

Le flux Awin n'est pas un accès universel à tous les sites : chaque programme doit être accessible au compte éditeur et l'annonceur doit proposer un flux produit. Les boutiques sans flux restent accessibles par les liens officiels dans DRESSOPP, mais leurs pages ne sont pas aspirées.

## Activer la synchronisation

1. Créer ou ouvrir un compte éditeur sur [Awin](https://ui.awin.com/).
2. Dans Awin, ouvrir **Boîte à outils → Créer un flux**.
3. Sélectionner la langue **Français**, puis consulter les enseignes accessibles et leurs flux produits. Rejoindre les programmes concernés quand c'est nécessaire.
4. Créer un flux et copier son **lien de téléchargement de la liste des flux produits**. Il contient la clé *Data Feed*. Cette clé est différente de la clé *Publisher API*.
5. Ouvrir les [secrets Actions du dépôt DRESSOPP](https://github.com/sopp24/DRESSOPP/settings/secrets/actions), créer un secret nommé exactement `AWIN_PRODUCT_FEED_LIST_URL` et coller le lien complet Awin en valeur.
6. Pour les flux Google Enhanced servis via `api.awin.com`, créer également le secret `AWIN_PUBLISHER_API_TOKEN` avec un jeton Publisher API Awin valide. Les flux CSV classiques continuent de fonctionner avec le premier secret seul.
7. Lancer [l'action d'actualisation du catalogue](https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-awin-catalog.yml) une première fois avec **Run workflow**.

Ne colle jamais cette clé dans le code, dans une issue ou dans un message public. Le secret est lu uniquement par GitHub Actions.

## Fréquence et fraîcheur

Le workflow vérifie la liste six fois par jour, à 01 h 17, 05 h 17, 09 h 17, 13 h 17, 17 h 17 et 21 h 17 (heure de Paris). Il ne télécharge un flux que si Awin signale une nouvelle version. La fraîcheur réelle dépend de la fréquence à laquelle le marchand met son propre flux à jour ; ce n'est donc pas une disponibilité garantie à la seconde près.

Le téléchargement est limité à trois flux simultanés, sous le plafond Awin de cinq demandes concurrentes. Si un flux échoue, les dernières données sont conservées dans le fichier de catalogue mais marquées comme périmées et retirées du swipe jusqu'à un nouveau contrôle réussi.

## Pinterest, Zalando personnel et Instagram

- **Pinterest** : le tableau public sert de référence stylistique. L'API Pinterest reste séparée et nécessite les autorisations de l'application Pinterest déjà décrites dans les paramètres.
- **Compte Zalando personnel** : le connecteur ne récupère ni identifiants, ni commandes, ni données privées. Seuls les flux produits auxquels le compte Awin a accès peuvent entrer dans le catalogue.
- **Publicités Instagram** : DRESSOPP ne peut pas lire le flux publicitaire personnalisé de ton compte. La [Meta Ad Library](https://www.facebook.com/ads/library/?active_status=active&ad_type=ALL&country=FR) peut aider à repérer des campagnes publiques, mais elle ne prouve pas la popularité auprès de ton compte personnel.
- **Avis** : les notes d'article (quand le flux les fournit) sont séparées de la fiabilité du marchand. DRESSOPP n'invente pas de score Trustpilot, Google, Avis Vérifiés, Trusted Shops ou Custplace. Une note de produit ne doit pas être présentée comme une note de confiance de la boutique.

## Boutiques prises en charge en mode accès direct

Même lorsqu'aucun flux Awin n'est disponible, les liens officiels de boutiques restent accessibles depuis la rubrique Découvrir : Zalando, ASOS, UNIQLO, Zara, BZB, Pull & Bear, Louis Vuitton, Dior, Lothaire, Nike, adidas, Courir, Undiz et Calvin Klein.

Les fiches de départ intégrées au dépôt sont des références vérifiées le 5 novembre 2026, et expirent le 12 novembre 2026 si elles ne sont pas remplacées. Elles ne remplacent pas le flux Awin.
