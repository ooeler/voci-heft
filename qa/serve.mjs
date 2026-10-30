// Testserver für den Black-Box-Tester. Aufruf: node serve.mjs <app-ordner> [port]
// - Der Browser lädt die App normal, aber Code-Dateien lassen sich nicht direkt öffnen.
// - Die echte config.js wird nie ausgeliefert. So kann der Test die echte Datenbank nicht erreichen.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 4173);
const NO_BACKEND = "/__kein-server";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".wasm": "application/wasm" };
const NAVIGATION = ["document", "iframe", "frame", "embed", "object"];

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const dest = req.headers["sec-fetch-dest"];
  const send = (code, type, body) => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };

  if (pathname.startsWith(NO_BACKEND)) return send(503, "application/json", '{"message":"Kein Server in der Testumgebung"}');
  if (pathname === "/config.js") {
    return send(200, TYPES[".js"], `window.VOCI_CONFIG = { supabaseUrl: "http://localhost:${port}${NO_BACKEND}", supabaseAnonKey: "test" };`);
  }
  const isPage = pathname === "/" || pathname === "/index.html";
  if (!isPage && (!dest || NAVIGATION.includes(dest))) return send(403, "text/plain; charset=utf-8", "Nur die App selbst ist erreichbar.");

  const file = normalize(join(root, isPage ? "index.html" : decodeURIComponent(pathname)));
  if (!file.startsWith(root)) return send(403, "text/plain; charset=utf-8", "Nein.");
  try { send(200, TYPES[extname(file)] || "application/octet-stream", await readFile(file)); }
  catch { send(404, "text/plain; charset=utf-8", "Nicht gefunden"); }
}).listen(port, "127.0.0.1", () => console.log(`Testserver auf http://localhost:${port}`));
