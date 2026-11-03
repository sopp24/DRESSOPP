import { readFile, writeFile } from "node:fs/promises";

const APP_ID = process.env.PINTEREST_APP_ID;
const APP_SECRET = process.env.PINTEREST_APP_SECRET;
const STATIC_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const BOARD_NAME = (process.env.PINTEREST_BOARD_NAME || "mode").trim().toLowerCase();
let TOKEN = "";
const BOARD_URL = "https://fr.pinterest.com/sopppx24/mode/";
const OUTPUT = "data/pinterest-pins.json";

async function obtainAccessToken() {
  if (STATIC_TOKEN) return STATIC_TOKEN;
  if (!APP_ID || !APP_SECRET) {
    console.log("::notice::Pinterest non synchronisé : ajoute les secrets PINTEREST_APP_ID et PINTEREST_APP_SECRET.");
    return "";
  }
  const credentials = Buffer.from(APP_ID + ":" + APP_SECRET).toString("base64");
  const response = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "boards:read,pins:read"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error("Impossible d'obtenir un jeton Pinterest : " + (payload.message || response.statusText));
  }
  return payload.access_token;
}

async function apiGet(path) {
  const response = await fetch("https://api.pinterest.com/v5" + path, {
    headers: {
      Authorization: "Bearer " + TOKEN,
      Accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.error || response.statusText;
    throw new Error("Pinterest API " + response.status + " : " + message);
  }
  return payload;
}

async function listAll(path) {
  const all = [];
  let bookmark = "";
  for (let page = 0; page < 40; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const suffix = new URLSearchParams({ page_size: "250", ...(bookmark ? { bookmark } : {}) });
    const payload = await apiGet(path + separator + suffix.toString());
    const items = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.boards) ? payload.boards : []);
    all.push(...items);
    bookmark = payload.bookmark || "";
    if (!bookmark) return all;
  }
  throw new Error("Pagination Pinterest interrompue après 40 pages (limite de sécurité).");
}

function pickImage(pin) {
  const images = pin.media && pin.media.images ? pin.media.images : {};
  return (images["1200x"] && images["1200x"].url) ||
    (images["600x"] && images["600x"].url) ||
    (images["400x300"] && images["400x300"].url) || "";
}

async function main() {
  TOKEN = await obtainAccessToken();
  if (!TOKEN) return;
  const boards = await listAll("/boards");
  const matches = boards.filter(board => String(board.name || "").trim().toLowerCase() === BOARD_NAME);
  if (matches.length !== 1) {
    throw new Error(matches.length
      ? "Plusieurs tableaux s'appellent « " + BOARD_NAME + " ». Rends leur nom unique ou définis PINTEREST_BOARD_NAME."
      : "Tableau « " + BOARD_NAME + " » introuvable pour le compte Pinterest autorisé.");
  }

  const board = matches[0];
  if (board.privacy !== "PUBLIC") {
    throw new Error("Sécurité : le tableau « " + BOARD_NAME + " » n'est pas explicitement PUBLIC. Aucun Pin ne sera copié dans ce dépôt public. Il faut une destination privée pour un tableau secret/protégé.");
  }

  const pins = await listAll("/boards/" + encodeURIComponent(board.id) + "/pins");
  const previous = await readFile(OUTPUT, "utf8").then(JSON.parse).catch(() => ({ pins: [] }));
  const previousIds = new Set((previous.pins || []).map(pin => String(pin.id)));
  const normalized = pins.map(pin => ({
    id: String(pin.id),
    title: pin.title || "",
    description: pin.description || "",
    altText: pin.alt_text || "",
    link: pin.link || "",
    pinUrl: "https://www.pinterest.com/pin/" + encodeURIComponent(pin.id) + "/",
    imageUrl: pickImage(pin),
    dominantColor: pin.dominant_color || "",
    createdAt: pin.created_at || null,
    boardId: String(board.id)
  })).filter(pin => pin.id);

  const newPinIds = normalized.filter(pin => !previousIds.has(pin.id)).map(pin => pin.id);
  const payload = {
    schemaVersion: 1,
    boardUrl: BOARD_URL,
    boardName: board.name,
    boardId: String(board.id),
    privacy: board.privacy,
    lastSync: new Date().toISOString(),
    totalPins: normalized.length,
    newPinIds,
    pins: normalized
  };

  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("Tableau vérifié : " + board.name + " (" + board.privacy + ")");
  console.log("Épingles récupérées : " + normalized.length);
  console.log("Nouvelles épingles depuis le dernier passage : " + newPinIds.length);
}

main().catch(error => {
  console.error("::error::" + error.message);
  process.exitCode = 1;
});
