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

async function verifyBoardTypography(page) {
  const metrics = await page.evaluate(() => {
    const read = selector => {
      const node = document.querySelector(selector);
      if (!node) throw new Error("Libellé de présentation absent : " + selector);
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        text: node.textContent.trim(),
        fontSize: Number.parseFloat(style.fontSize),
        width: box.width,
        height: box.height,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth
      };
    };
    return {
      desktopTitle: read(".screen-label-main strong"),
      desktopSubtitle: read(".screen-label-main small"),
      trainingTitle: read(".phone-labels > div:first-child strong"),
      trainingSubtitle: read(".phone-labels > div:first-child small"),
      outfitsTitle: read(".phone-labels > div:last-child strong"),
      outfitsSubtitle: read(".phone-labels > div:last-child small")
    };
  });
  const required = [
    ["desktopTitle", 16],
    ["desktopSubtitle", 13],
    ["trainingTitle", 16],
    ["trainingSubtitle", 13],
    ["outfitsTitle", 16],
    ["outfitsSubtitle", 13]
  ];
  for (const [key, minimum] of required) {
    const item = metrics[key];
    if (item.fontSize < minimum || item.scrollWidth > item.clientWidth + 1) {
      throw new Error("Libellé trop petit ou tronqué dans le PDF : " + key + " " + JSON.stringify(item));
    }
  }
  console.log("Board typography verified: three feature titles >=16px and subtitles >=13px.", metrics);
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

async function verifyShowcaseViews(page) {
  const frames = await page.locator("iframe").all();
  if (frames.length !== 3) throw new Error("Les trois vues DRESSOPP ne sont pas présentes.");
  const views = await Promise.all(frames.map(frame => frame.evaluate(node => {
    const url = new URL(node.contentWindow.location.href);
    const main = node.contentDocument && node.contentDocument.querySelector("#app-main");
    const doc = node.contentDocument;
    const win = node.contentWindow;
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {x:box.x,y:box.y,width:box.width,height:box.height,right:box.right,bottom:box.bottom};
    };
    const logo = doc && doc.querySelector(".topbar .brand-logo");
    const nav = doc && doc.querySelector(".mobile-nav");
    const filter = main && main.querySelector(".filter-menu-trigger");
    const card = main && main.querySelector("#active-product-card");
    const visual = card && card.querySelector(".product-visual");
    const actions = main && main.querySelector(".deck-actions");
    const content = doc && doc.querySelector(".main-content");
    return {
      view: url.searchParams.get("showcase"),
      viewportWidth: win ? win.innerWidth : 0,
      viewportHeight: win ? win.innerHeight : 0,
      desktopCard: Boolean(card),
      desktopVoteActions: main ? main.querySelectorAll('[data-action="vote"]').length : 0,
      desktopActionCount: actions ? actions.querySelectorAll("button").length : 0,
      desktopLogo: rect(logo),
      desktopTopbar: rect(doc && doc.querySelector(".topbar")),
      desktopNav: rect(nav),
      desktopFilter: rect(filter),
      desktopContent: rect(content),
      desktopCardRect: rect(card),
      desktopVisualRect: rect(visual),
      desktopActionsRect: rect(actions),
      usesClassicCard: Boolean(main && main.querySelector(".discovery-page") && !main.querySelector(".discovery-page--app")),
      ready: Boolean(main && main.children.length && !main.querySelector(".boot-loader"))
    };
  })));
  const expected = ["discover","training","outfits"];
  views.forEach((view,index) => {
    if (view.view !== expected[index]) throw new Error("Vue embarquée inattendue : " + JSON.stringify(view));
    if (!view.ready) throw new Error("La vue embarquée n'est pas prête : " + expected[index]);
  });
  if (views[0].viewportWidth < 1101) throw new Error("L'écran principal n'utilise pas le layout ordinateur : " + views[0].viewportWidth + "px");
  const desktop = views[0];
  if (!desktop.desktopCard || desktop.desktopVoteActions !== 2 || desktop.desktopActionCount !== 5) {
    throw new Error("La fenêtre ordinateur n'affiche pas la fiche et ses cinq actions : " + JSON.stringify(desktop));
  }
  if (!desktop.usesClassicCard || !desktop.desktopLogo || desktop.desktopLogo.width < 120 || desktop.desktopLogo.height < 50) {
    throw new Error("La fenêtre ordinateur ne reprend pas le header/logo de la page de référence : " + JSON.stringify(desktop));
  }
  if (!desktop.desktopNav || desktop.desktopNav.width < 900 || desktop.desktopNav.height < 50 ||
      desktop.desktopNav.bottom > desktop.viewportHeight) {
    throw new Error("La navigation inférieure n'est pas visible dans la fenêtre ordinateur : " + JSON.stringify(desktop));
  }
  if (!desktop.desktopFilter || desktop.desktopFilter.right < desktop.desktopContent.right - 60) {
    throw new Error("Le bouton Filtres n'est pas aligné à droite comme sur le PDF : " + JSON.stringify(desktop));
  }
  if (!desktop.desktopVisualRect || desktop.desktopVisualRect.width / desktop.desktopVisualRect.height < 1.35) {
    throw new Error("La photo produit n'a pas retrouvé son cadrage horizontal dans le board : " + JSON.stringify(desktop));
  }
  if (!desktop.desktopActionsRect || desktop.desktopActionsRect.bottom >= desktop.desktopNav.y - 10) {
    throw new Error("Les actions produit sont coupées par la navigation du bas : " + JSON.stringify(desktop));
  }
  if (views[1].viewportWidth > 850 || views[2].viewportWidth > 850) {
    throw new Error("Les aperçus Entraînement et Tenues doivent rester au format mobile : " + JSON.stringify(views));
  }
  const desktopFrame = page.frames().find(frame => {
    try { return new URL(frame.url()).searchParams.get("showcase") === "discover"; }
    catch (error) { return false; }
  });
  if (!desktopFrame) throw new Error("La fenêtre ordinateur interactive est introuvable.");
  const firstProductId = await desktopFrame.locator("#active-product-card").getAttribute("data-product-id");
  await desktopFrame.locator('[data-action="vote"][data-vote="no"]').click();
  await desktopFrame.waitForFunction(previousId => {
    const card = document.querySelector("#active-product-card");
    return Boolean(card && card.dataset.productId !== previousId);
  }, firstProductId, { timeout:8000 });
  await desktopFrame.goto(desktopFrame.url());
  await desktopFrame.waitForSelector("#active-product-card", { timeout:8000 });
  await desktopFrame.locator("#active-product-card").press("Enter");
  await desktopFrame.locator('[role="dialog"]').waitFor({ state:"visible", timeout:8000 });
  await desktopFrame.locator('[role="dialog"] [data-action="close-modal"]').click();
  console.log("Showcase screens verified: desktop Découvrir at " + views[0].viewportWidth + "px with working swipe and product details, mobile Entraînement/Tenues at " + views[1].viewportWidth + "/" + views[2].viewportWidth + "px.");
}

async function writePdf(page, output, expectedWidth, expectedHeight) {
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);
  await verifyBoardTypography(page);
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

  if (process.env.DRESSOPP_BOARD_QA_ONLY === "1") {
    await loadBoard(page, "http://127.0.0.1:4173/board.html");
    await verifyShowcaseViews(page);
    await verifyBoardTypography(page);
    console.log("Interactive board QA and feature-label typography checks passed; PDF files are generated in the full export job.");
  } else {
    await loadBoard(page, "http://127.0.0.1:4173/board.html");
    await verifyShowcaseViews(page);
    await writePdf(page, path.join(root, "DRESSOPP-Board-A3.pdf"), 420, 297);

    // Imprimeur : format SRA3 (450 x 320 mm), coupe A3 (420 x 297 mm),
    // fond perdu réel de 3 mm sur les quatre côtés et repères hors coupe.
    await loadBoard(page, "http://127.0.0.1:4173/board.html?cropMarks=1");
    await verifyShowcaseViews(page);
    if (!(await page.locator(".crop-sheet").count())) throw new Error("Les traits de coupe sont absents.");
    if (!(await page.locator(".bleed-underlay").count())) throw new Error("Le fond perdu est absent.");
    await verifyPrintGeometry(page);
    await writePdf(page, path.join(root, "DRESSOPP-Board-Imprimeur-SRA3.pdf"), 450, 320);

    console.log("Fresh DRESSOPP A3 and SRA3 printer PDFs are ready.");
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
