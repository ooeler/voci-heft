// Kurzer Funktionstest ohne API-Schlüssel. Läuft bei jedem Pull Request, auch bei Updates von Dependabot.
// Aufruf: node smoke.mjs <app-ordner>. Exit 1, wenn die App nicht startet oder eine Bibliothek nicht mehr funktioniert.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const dir = process.argv[2] || "../dist", port = 4180, url = `http://localhost:${port}/`;
const server = spawn(process.execPath, ["serve.mjs", dir, String(port)], { stdio: "inherit" });
const fail = msg => { console.error("Smoke-Test fehlgeschlagen: " + msg); process.exitCode = 1; };
const step = msg => console.log("✓ " + msg);

const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL || undefined }); // lokal z. B. SMOKE_CHANNEL=msedge
try {
  await new Promise(r => setTimeout(r, 800));
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Line cannot be recognized|Image too small/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);

  await page.getByRole("button", { name: "Ohne Konto ausprobieren" }).click();
  await page.getByRole("button", { name: "Lernen", exact: true }).first().click();
  await page.locator("[data-opt]").first().click();
  await page.locator("#fb .feedback").waitFor();
  step("Anmeldeseite, Übersicht und eine Quizfrage");

  const libs = await page.evaluate(async () => {
    const { default: Anthropic } = await import("./vendor/anthropic.js");
    return { anthropic: typeof Anthropic === "function" && typeof Anthropic.PermissionDeniedError === "function",
             supabase: typeof window.supabase?.createClient === "function" };
  });
  if (!libs.anthropic) fail("Claude-SDK lässt sich nicht laden");
  if (!libs.supabase) fail("Supabase-Bibliothek fehlt");
  step("Claude-SDK und Supabase geladen");

  // Texterkennung mit dem englischen Testbild: muss die bekannten Wortpaare finden
  const png = readFileSync(new URL("./fixtures/englisch-liste.png", import.meta.url)).toString("base64");
  const pairs = await page.evaluate(async b64 => {
    await loadScript(TESSERACT_URL);
    const w = await Tesseract.createWorker("deu+eng", 1, {
      workerPath: new URL("vendor/tesseract-worker.min.js", location.href).href,
      corePath: new URL("vendor/tesseract-core", location.href).href, workerBlobURL: false,
      langPath: new URL("vendor/lang", location.href).href
    });
    await w.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1", user_defined_dpi: "300" });
    const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: "image/png" });
    const data = await readPhoto(w, blob);
    await w.terminate();
    return parsePairs(rowsFromBlocks(data.blocks), "en-GB").map(p => p.fx + " = " + p.de);
  }, png);
  if (!pairs.includes("the kitchen = die Küche") || pairs.length < 6) fail("Texterkennung liefert zu wenig: " + JSON.stringify(pairs));
  else step(`Texterkennung: ${pairs.length} Wortpaare`);

  if (errors.length) fail("Fehler in der Konsole: " + errors.join(" | "));
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
  server.kill();
}
