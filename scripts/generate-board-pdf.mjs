import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "board.pdf");
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".avif": "image/avif", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(4173, "127.0.0.1", resolve);
});

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1358 },
    deviceScaleFactor: 1
  });
  page.setDefaultTimeout(90000);
  const response = await page.goto("http://127.0.0.1:4173/board.html", { waitUntil: "domcontentloaded" });
  if (!response || !response.ok()) throw new Error("Le board HTML n'a pas pu être chargé.");

  // Attendre les vraies vues de l'application à l'intérieur des trois iframes.
  const frames = await page.locator("iframe").all();
  if (frames.length < 3) throw new Error("Les trois aperçus DRESSOPP sont absents du board.");
  for (const locator of frames) {
    await locator.evaluate(async (frame) => {
      const waitForApp = () => new Promise((resolve, reject) => {
        const deadline = Date.now() + 90000;
        const poll = () => {
          try {
            const doc = frame.contentDocument;
            const main = doc && doc.querySelector("#app-main");
            if (main && main.children.length && !main.querySelector(".boot-loader")) return resolve();
          } catch {}
          if (Date.now() > deadline) return reject(new Error("Une vue embarquée DRESSOPP ne s'est pas initialisée."));
          setTimeout(poll, 300);
        };
        poll();
      });
      await waitForApp();
    });
  }

  // Stabiliser les polices et les visuels visibles sans attendre les 60 Pins hors écran.
  await page.evaluate(async () => {
    const withDeadline = (promise, ms) => Promise.race([
      promise.catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, ms))
    ]);
    await withDeadline(document.fonts.ready, 8000);
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const frame of frames) {
      try {
        const win = frame.contentWindow;
        if (!win || !win.document) continue;
        await withDeadline(win.document.fonts.ready, 5000);
        const viewportHeight = win.innerHeight || 844;
        const images = Array.from(win.document.images || []).filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top < viewportHeight * 1.25 && rect.bottom > 0;
        }).slice(0, 6);
        await withDeadline(Promise.all(images.map(img => img.decode().catch(() => undefined))), 9000);
      } catch {}
    }
  });
  console.log("Visible board screens and product imagery are ready for A3 export.");

  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: output,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    scale: 1
  });

  const pdf = await readFile(output);
  if (pdf.subarray(0, 5).toString() !== "%PDF-" || pdf.length < 50000) {
    throw new Error("Le PDF généré semble incomplet.");
  }
  console.log("Board PDF generated:", output, pdf.length, "bytes");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
