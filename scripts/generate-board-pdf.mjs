import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

async function loadBoard(page, url) {
  page.setDefaultTimeout(90000);
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (!response || !response.ok()) throw new Error("Le board HTML n'a pas pu être chargé.");
  const frames = await page.locator("iframe").all();
  if (frames.length < 3) throw new Error("Les trois aperçus DRESSOPP sont absents du board.");
  for (const locator of frames) {
    await locator.evaluate(async (frame) => {
      await new Promise((resolve, reject) => {
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
    });
  }
  await page.evaluate(async () => {
    const withDeadline = (promise, ms) => Promise.race([
      promise.catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, ms))
    ]);
    await withDeadline(document.fonts.ready, 8000);
    for (const frame of Array.from(document.querySelectorAll("iframe"))) {
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
}

async function verifyPrintGeometry(page) {
  await page.emulateMedia({ media: "print" });
  const metrics = await page.evaluate(() => {
    const read = selector => {
      const node = document.querySelector(selector);
      if (!node) throw new Error("Élément de prépresse manquant : " + selector);
      const rect = node.getBoundingClientRect();
      return {
        x: rect.x * 25.4 / 96,
        y: rect.y * 25.4 / 96,
        width: rect.width * 25.4 / 96,
        height: rect.height * 25.4 / 96
      };
    };
    return {
      bleed: read(".bleed-underlay"),
      trim: read(".board"),
      marks: read(".crop-sheet")
    };
  });
  const within = (actual, expected) => Math.abs(actual - expected) <= 0.5;
  const valid =
    within(metrics.bleed.x,12) && within(metrics.bleed.y,8.5) &&
    within(metrics.bleed.width,426) && within(metrics.bleed.height,303) &&
    within(metrics.trim.x,15) && within(metrics.trim.y,11.5) &&
    within(metrics.trim.width,420) && within(metrics.trim.height,297) &&
    within(metrics.marks.x,0) && within(metrics.marks.y,0) &&
    within(metrics.marks.width,450) && within(metrics.marks.height,320);
  if (!valid) throw new Error("Géométrie d'impression invalide : " + JSON.stringify(metrics));
  console.log("Print preflight OK: A3 trim 420x297 mm, 3 mm bleed on all sides, SRA3 450x320 mm.");
}

async function verifyFeaturedProducts(page) {
  const frames = await page.locator("iframe").all();
  if (frames.length < 2) throw new Error("Les aperçus desktop et mobile sont absents.");
  const desktopProductId = await frames[0].evaluate(frame => {
    const card = frame.contentDocument && frame.contentDocument.querySelector("#active-product-card");
    return card ? card.getAttribute("data-product-id") : "";
  });
  const trainingProductId = await frames[1].evaluate(frame => {
    const card = frame.contentDocument && frame.contentDocument.querySelector("#active-product-card");
    return card ? card.getAttribute("data-product-id") : "";
  });
  if (desktopProductId !== "web-1utdu9o") throw new Error("Le premier écran doit présenter le hoodie : " + desktopProductId);
  if (trainingProductId !== "web-1uijpt2") throw new Error("L'entraînement doit présenter les sneakers : " + trainingProductId);
  console.log("Featured screens verified: hoodie on desktop, sneakers in training.");
}

async function writePdf(page, output, expectedWidth, expectedHeight) {
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
    throw new Error("Le PDF généré semble incomplet : " + output);
  }
  console.log("Board PDF generated:", path.basename(output), pdf.length, "bytes", expectedWidth + "x" + expectedHeight + " mm");
}

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1358 }, deviceScaleFactor: 1 });

  await loadBoard(page, "http://127.0.0.1:4173/board.html");
  await verifyFeaturedProducts(page);
  await writePdf(page, path.join(root, "board.pdf"), 420, 297);

  // Second PDF: A3 trim centred on SRA3, with 3 mm bleed on all sides and crop marks outside the trim.
  await loadBoard(page, "http://127.0.0.1:4173/board.html?cropMarks=1");
  await verifyFeaturedProducts(page);
  if (!(await page.locator(".crop-sheet").count())) throw new Error("Les traits de coupe sont absents.");
  if (!(await page.locator(".bleed-underlay").count())) throw new Error("Le fond perdu est absent.");
  await verifyPrintGeometry(page);
  await writePdf(page, path.join(root, "board-print-a3.pdf"), 450, 320);

  console.log("Both A3 PDF variants are ready; the print version includes 3 mm bleed and crop marks.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
