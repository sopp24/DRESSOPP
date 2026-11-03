export const PINTEREST_BOARD_URL = "https://fr.pinterest.com/sopppx24/mode/";
export const INTEGRATIONS = [
  {
    id: "pinterest",
    name: "Pinterest",
    status: "API officielle — configuration requise",
    detail: "Le tableau mode est la seule source d'inspiration. Une synchronisation quotidienne récupère les nouveaux Pins via Pinterest API v5 lorsque le secret GitHub est configuré."
  }
];

export function integrationById(id) {
  return INTEGRATIONS.find(function(item) { return item.id === id; }) || null;
}

export function getPersistenceNotice() {
  return "Les préférences, décisions Oui/Non, la garde-robe et les Pins consultés sont conservés dans IndexedDB sur cet appareil. Le flux Pinterest synchronisé depuis le dépôt public contient uniquement les données du tableau si Pinterest le confirme PUBLIC.";
}
