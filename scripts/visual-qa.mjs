import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.DRESSOPP_BASE_URL || "https://sopp24.github.io/DRESSOPP/";
const artifactDir = process.env.VISUAL_QA_DIR || "artifacts/visual-qa";
const results = [];
const pageErrors = [];
let server;

const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml" };

async function startLocalServer() {
  const root = process.cwd();
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      const relative = normalize(pathname.replace(/^\/+/, "")) || "index.html";
      const file = join(root, relative);
      if (!file.startsWith(root)) throw new Error("Invalid path");
      const info = await stat(file);
      const target = info.isDirectory() ? join(file, "index.html") : file;
      response.writeHead(200, { "content-type": mime[extname(target)] || "application/octet-stream" });
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4173, "127.0.0.1", resolve); });
  return "http://127.0.0.1:4173/";
}

async function ensureAppReady(page) {
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || !response.ok()) throw new Error("Page non accessible : " + (response && response.status()));
  await page.locator("#app-main").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const main = document.querySelector("#app-main");
    return main && (main.querySelector("#active-product-card") || main.querySelector(".empty-state") || main.querySelector(".discovery-page"));
  }, null, { timeout: 45000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(450);
}

async function getLayout(page) {
  return page.evaluate(() => {
    const main = document.querySelector("#app-main");
    const card = document.querySelector("#active-product-card");
    const actions = document.querySelector(".deck-actions");
    const nav = document.querySelector(".mobile-nav");
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x:Math.round(box.x), y:Math.round(box.y), width:Math.round(box.width), height:Math.round(box.height), top:Math.round(box.top), right:Math.round(box.right), bottom:Math.round(box.bottom) };
    };
    const visibleNav = nav && getComputedStyle(nav).display !== "none";
    const actionSizes = Array.from(document.querySelectorAll(".deck-action")).map(button => {
      const box = button.getBoundingClientRect();
      return { label:button.getAttribute("aria-label"), width:Math.round(box.width), height:Math.round(box.height) };
    });
    return {
      viewport:{width:innerWidth,height:innerHeight},
      document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
      horizontalOverflow:document.documentElement.scrollWidth > innerWidth + 1,
      main:rect(main), card:rect(card), actions:rect(actions), mobileNav:visibleNav ? rect(nav) : null,
      cardOverlapsNav:Boolean((card || actions) && visibleNav && document.body.classList.contains("is-discovery-app") &&
        Math.max(card ? card.getBoundingClientRect().bottom : 0, actions ? actions.getBoundingClientRect().bottom : 0) > nav.getBoundingClientRect().top + 3),
      actionSizes
    };
  });
}

async function capture(page, viewportName, viewName, fullPage = false) {
  const path = artifactDir + "/" + viewportName + "-" + viewName + ".png";
  await page.screenshot({ path, fullPage, animations:"disabled" });
  const layout = await getLayout(page);
  const issues = [];
  if (layout.horizontalOverflow) issues.push("débordement horizontal (" + layout.document.width + "px pour " + layout.viewport.width + "px)");
  if (layout.cardOverlapsNav) issues.push("la carte de swipe passe sous la navigation basse");
  if (layout.viewport.width <= 850) {
    const undersized = layout.actionSizes.filter(item => item.width < 44 || item.height < 44);
    if (undersized.length) issues.push("actions tactiles trop petites : " + undersized.map(item => item.label + " " + item.width + "×" + item.height).join(", "));
    if (layout.mobileNav && layout.mobileNav.height < 44) issues.push("navigation tactile trop basse");
  }
  results.push({ viewport:viewportName, view:viewName, screenshot:path, ...layout, issues });
}

async function clickView(page, name, mobile) {
  const selector = '.mobile-nav [data-view="' + name + '"]';
  const button = page.locator(selector);
  await button.waitFor({ state:"visible", timeout:12000 });
  await button.click();
  await page.waitForTimeout(220);
}

async function runViewport(browser, config) {
  const context = await browser.newContext({
    viewport:{width:config.width,height:config.height},
    deviceScaleFactor:config.mobile ? 2 : 1,
    isMobile:Boolean(config.mobile),
    hasTouch:Boolean(config.mobile)
  });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(config.name + ": " + error.message));
  await ensureAppReady(page);
  await capture(page, config.name, "pour-toi");
  if (config.name === "phone-390" && await page.locator("#active-product-card").count()) {
    const card = page.locator("#active-product-card");
    const firstId = await card.getAttribute("data-product-id");
    const firstBox = await card.boundingBox();
    if (firstBox) {
      await page.mouse.move(firstBox.x + firstBox.width * 0.8, firstBox.y + firstBox.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(firstBox.x + firstBox.width * 0.18, firstBox.y + firstBox.height * 0.45, {steps:10});
      await page.mouse.up();
      try {
        await page.waitForFunction(previousId => {
          const active = document.querySelector("#active-product-card");
          return !active || active.dataset.productId !== previousId;
        }, firstId, {timeout:6000});
      } catch {
        results.push({viewport:config.name,view:"swipe-horizontal",issues:["le glissement horizontal ne passe pas à l'article suivant"]});
      }
      const nextCard = page.locator("#active-product-card");
      if (await nextCard.count()) {
        const nextId = await nextCard.getAttribute("data-product-id");
        const nextBox = await nextCard.boundingBox();
        const savedBefore = Number(await page.locator("#wardrobe-count").textContent());
        if (nextBox) {
          await page.evaluate(() => {
            window.__dressoppGestureQA = [];
            const card = document.querySelector("#active-product-card");
            const surface = card && (card.closest(".deck-card-wrap") || card);
            if (!surface) return;
            ["pointerdown","pointermove","pointerup","pointercancel","lostpointercapture"].forEach(type => surface.addEventListener(type,event => {
              window.__dressoppGestureQA.push({type,pointerId:event.pointerId,button:event.button,x:Math.round(event.clientX),y:Math.round(event.clientY),className:card.className});
            }));
          });
          // Start the vertical gesture within the product image, not on the source link.
          await page.mouse.move(nextBox.x + nextBox.width * 0.5, nextBox.y + nextBox.height * 0.17);
          await page.mouse.down();
          await page.mouse.move(nextBox.x + nextBox.width * 0.5, nextBox.y + nextBox.height * 0.50, {steps:10});
          await page.mouse.up();
          try {
            await page.waitForFunction(previousCount => Number(document.querySelector("#wardrobe-count").textContent) > previousCount, savedBefore, {timeout:6000});
          } catch {
            const diagnostics = await page.evaluate(() => ({
              events:window.__dressoppGestureQA || [],
              count:document.querySelector("#wardrobe-count")?.textContent || null,
              cardClass:document.querySelector("#active-product-card")?.className || null,
              cardId:document.querySelector("#active-product-card")?.dataset.productId || null
            }));
            results.push({viewport:config.name,view:"swipe-save",productId:nextId,diagnostics,issues:["le glissement vers le bas n'ajoute pas l'article à la liste"]});
          }
        }
      }
    }
  }
  if (config.name === "desktop-1440" && await page.locator("#active-product-card").count()) {
    const card = page.locator("#active-product-card");
    await card.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state:"visible", timeout:8000 });
    const focusedInside = await dialog.evaluate(element => element.contains(document.activeElement));
    if (!focusedInside) results.push({viewport:config.name,view:"modal",issues:["le focus initial n'entre pas dans la fenêtre de détails"]});
    await page.keyboard.press("Shift+Tab");
    const trapped = await dialog.evaluate(element => element.contains(document.activeElement));
    if (!trapped) results.push({viewport:config.name,view:"modal",issues:["la tabulation sort de la fenêtre de détails"]});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    const restored = await page.evaluate(() => document.activeElement && document.activeElement.id === "active-product-card");
    if (!restored) results.push({viewport:config.name,view:"modal",issues:["le focus ne revient pas sur la carte après fermeture"]});
  }
  const mobile = config.width <= 850;
  for (const view of ["wardrobe","training","outfits","profile","settings"]) {
    await clickView(page, view, mobile);
    await capture(page, config.name, view, true);
  }
  await context.close();
}

async function main() {
  await mkdir(artifactDir, {recursive:true});
  let target = baseUrl;
  if (process.env.VISUAL_QA_LOCAL === "1") target = await startLocalServer();
  const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  try {
    const viewports = [
      {name:"desktop-1440",width:1440,height:900},
      {name:"laptop-1024",width:1024,height:768},
      {name:"tablet-768",width:768,height:1024,mobile:true},
      {name:"phone-390",width:390,height:844,mobile:true},
      {name:"phone-320",width:320,height:720,mobile:true},
      {name:"phone-landscape",width:844,height:390,mobile:true}
    ];
    for (const viewport of viewports) await runViewport(browser, viewport);
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
  const issues = results.flatMap(entry => (entry.issues || []).map(issue => entry.viewport + "/" + entry.view + ": " + issue));
  const report = { testedUrl:target, testedAt:new Date().toISOString(), viewports:6, screenshots:results.length, pageErrors, issues, results };
  await writeFile(artifactDir + "/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (pageErrors.length || issues.length) process.exitCode = 1;
}

main().catch(async error => {
  console.error(error);
  try {
    await mkdir(artifactDir, {recursive:true});
    await writeFile(artifactDir + "/report.json", JSON.stringify({
      testedUrl:process.env.VISUAL_QA_LOCAL === "1" ? "local source checkout" : baseUrl,
      testedAt:new Date().toISOString(),
      fatalError:error && error.stack ? error.stack : String(error),
      pageErrors,
      results
    }, null, 2));
  } catch (reportError) {
    console.error("Impossible d'écrire le rapport de secours :", reportError);
  }
  process.exitCode = 1;
});
