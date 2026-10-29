// Baut die App in den Ordner dist/: eigene Dateien plus die Bibliotheken aus node_modules.
// So lädt die App keinen Code von fremden Servern. Mit --check wird zusätzlich geprüft,
// ob alle Dateien da sind, auf die die App verweist.
import { cp, mkdir, readFile, readdir, rm, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const OUT = "dist";
const APP_FILES = ["index.html", "app.js", "style.css", "config.js", "sw.js", "manifest.webmanifest", "icons"];
const nm = p => "node_modules/" + p;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT + "/vendor/tesseract-core", { recursive: true });
await mkdir(OUT + "/vendor/hyphen/patterns", { recursive: true });
for (const f of APP_FILES) await cp(f, `${OUT}/${f}`, { recursive: true });

await cp(nm("@supabase/supabase-js/dist/umd/supabase.js"), OUT + "/vendor/supabase.js");
await cp(nm("tesseract.js/dist/tesseract.min.js"), OUT + "/vendor/tesseract.min.js");
await cp(nm("tesseract.js/dist/worker.min.js"), OUT + "/vendor/tesseract-worker.min.js");
for (const f of await readdir(nm("tesseract.js-core")))
  if (f.endsWith(".wasm.js")) await cp(nm("tesseract.js-core/" + f), `${OUT}/vendor/tesseract-core/${f}`);
await cp(nm("hyphen/hyphen.js"), OUT + "/vendor/hyphen/hyphen.js");
for (const p of ["en-gb", "fr", "it", "es", "pt", "nl", "la"])
  await cp(nm(`hyphen/patterns/${p}.js`), `${OUT}/vendor/hyphen/patterns/${p}.js`);

// Das Claude-SDK ist ein Node-Paket; esbuild macht daraus eine einzelne Datei für den Browser.
await build({
  stdin: { contents: 'export { default } from "@anthropic-ai/sdk";', resolveDir: ".", loader: "js" },
  bundle: true, format: "esm", platform: "browser", target: "es2020", minify: true,
  outfile: OUT + "/vendor/anthropic.js", logLevel: "warning"
});

// Neue Version für den Service Worker: Prüfsumme über alle Dateien, damit Geräte jede Änderung laden.
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await files(p)); else out.push(p);
  }
  return out.sort();
}
const hash = createHash("sha256");
for (const f of await files(OUT)) if (!f.endsWith("/sw.js")) hash.update(f).update(await readFile(f));
const version = "voci-heft-" + hash.digest("hex").slice(0, 12);
const sw = await readFile(OUT + "/sw.js", "utf8");
if (!/const VERSION = "[^"]*";/.test(sw)) throw new Error("VERSION fehlt in sw.js");
await writeFile(OUT + "/sw.js", sw.replace(/const VERSION = "[^"]*";/, `const VERSION = "${version}";`));
console.log("Gebaut:", version);

if (process.argv.includes("--check")) {
  // Alle lokalen Pfade in index.html, sw.js und app.js müssen im Build vorhanden sein.
  const refs = new Set();
  const html = await readFile(OUT + "/index.html", "utf8");
  for (const m of html.matchAll(/(?:src|href)="(?!https?:|#)([^"]+)"/g)) refs.add(m[1]);
  for (const m of sw.matchAll(/"((?:vendor|icons)\/[^"]+|[\w.-]+\.(?:js|css|html|webmanifest))"/g)) refs.add(m[1]);
  const app = await readFile(OUT + "/app.js", "utf8");
  for (const m of app.matchAll(/"(vendor\/[^"]+\.js)"/g)) refs.add(m[1]);
  const missing = [];
  for (const r of refs) await stat(`${OUT}/${r}`).catch(() => missing.push(r));
  if (missing.length) { console.error("Fehlende Dateien:", missing.join(", ")); process.exit(1); }
  console.log("Geprüft:", refs.size, "Verweise vorhanden.");
}
