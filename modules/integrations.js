export const INTEGRATIONS = [
  { id: "pinterest", name: "Pinterest", status: "Import manuel disponible", detail: "Ajoute un lien de Pin ou importe une image. OAuth nécessite un service serveur pour protéger le secret client et gérer les jetons." },
  { id: "zalando", name: "Zalando", status: "Catalogue non connecté", detail: "Les liens produits peuvent être ajoutés manuellement. Aucun accès catalogue/API partenaire n’est configuré dans ce dépôt." },
  { id: "instagram", name: "Instagram Ads", status: "Import manuel disponible", detail: "Importe une URL de publication, une capture ou une image. DRESSOPP ne lit pas ton fil publicitaire personnel." },
  { id: "shops", name: "Autres marchands", status: "Import par fiche produit", detail: "Les articles sont normalisés dans un format commun. Aucun scraping ni prix supposé n’est effectué." }
];
export function integrationById(id) {
  return INTEGRATIONS.find(function(item) { return item.id === id; }) || null;
}
export function getPersistenceNotice() {
  return "Les données sont conservées dans le stockage IndexedDB de ce navigateur. La synchronisation entre appareils via GitHub nécessite un backend sécurisé et un dépôt privé pour les données personnelles.";
}
