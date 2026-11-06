# Recommandations communautaires gratuites

DRESSOPP peut apprendre des préférences de plusieurs utilisateurs qui choisissent volontairement de contribuer. Cette fonction est désactivée par défaut.

## Créer le projet gratuit

1. Créer un projet sur https://console.firebase.google.com/ sans activer la facturation.
2. Conserver le plan **Spark** (gratuit).
3. Dans Authentication → Sign-in method, activer **Anonymous**.
4. Créer une base Cloud Firestore en mode natif.
5. Dans Project settings → General, enregistrer une application Web et relever **Web API Key** et **Project ID**.
6. Ouvrir le fichier `data/community-config.json` dans le dépôt. Renseigner `apiKey` et `projectId`, puis passer `enabled` à `true`. La clé Web Firebase est une configuration publique ; la sécurité repose sur les règles Firestore ci-dessous.

## Règles Firestore

Remplacer les règles de la base par les règles suivantes :

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /communityProfiles/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.keys().hasOnly(['schemaVersion', 'updatedAt', 'positive', 'negative', 'positiveItems', 'negativeItems'])
        && request.resource.data.schemaVersion == 1
        && request.resource.data.updatedAt is timestamp
        && request.resource.data.positive is list
        && request.resource.data.positive.size() <= 60
        && request.resource.data.negative is list
        && request.resource.data.negative.size() <= 40
        && request.resource.data.positiveItems is list
        && request.resource.data.positiveItems.size() <= 40
        && request.resource.data.negativeItems is list
        && request.resource.data.negativeItems.size() <= 30;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Publier les règles avant de cocher le partage dans DRESSOPP.

## Données partagées et confidentialité

DRESSOPP ne partage pas de nom, d'e-mail, de taille, de budget, d'historique de navigation, de lien Pinterest, ni de contenu libre. Le profil communautaire contient des étiquettes générales de styles, catégories, marques, couleurs et matières appréciées ou évitées, ainsi que des identifiants hachés de fiches publiques aimées, enregistrées ou refusées. Les URL, noms de produits et identifiants de fiches bruts ne sont pas transmis. Chaque navigateur reçoit un identifiant Firebase aléatoire et pseudonyme ; les membres authentifiés peuvent lire les profils communautaires. Ces données ne sont donc pas anonymes au sens strict. Les identifiants d'articles sont des hachages déterministes, pas du chiffrement : comme le catalogue et le code sont publics, un membre techniquement averti peut recalculer ces hachages à partir des fiches publiques et déduire certains produits aimés ou refusés. Certaines combinaisons de goûts peuvent aussi rester distinctives. La contribution est facultative et désactivable dans Paramètres ; la désactivation supprime le document communautaire associé.

Les utilisateurs similaires sont calculés localement à partir des étiquettes communes. Le moteur utilise ensuite les tendances positives/négatives de ces profils pour ajuster le classement des articles déjà présents dans le catalogue. Les identifiants hachés permettent de reconnaître une même fiche publique appréciée par plusieurs personnes, sans transmettre son URL brute. Cela ne signifie pas que DRESSOPP connaît les recherches privées des utilisateurs d'autres sites.

## Quotas gratuits officiels

Le plan Firebase Spark est sans facturation. Firestore inclut actuellement, pour une base gratuite : 1 Gio de stockage, 50 000 lectures de documents par jour, 20 000 écritures par jour, 20 000 suppressions par jour et 10 Gio de transfert sortant par mois. Si un quota est dépassé, le service concerné est suspendu jusqu'au prochain cycle ; il ne bascule pas automatiquement en facturation tant que le projet reste sur Spark.

Sources : https://firebase.google.com/docs/projects/billing/firebase-pricing-plans et https://firebase.google.com/docs/firestore/quotas
