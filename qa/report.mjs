// Macht aus dem Resultat des Testers den PR-Kommentar und legt fest, ob der Check besteht.
// Aufruf: node report.mjs [resultat.json] [kommentar.md]. Exit 1 bei Blocker oder ohne gültigen Bericht.
import { readFileSync, writeFileSync } from "node:fs";

const [input = "bericht/resultat.json", output = "bericht/kommentar.md"] = process.argv.slice(2);
const ICON = { blocker: "🛑", hoch: "🔴", mittel: "🟠", tief: "🟡" };
const ORDER = ["blocker", "hoch", "mittel", "tief"];
// Texte stammen aus der getesteten App: niemanden erwähnen, keine Überschriften oder Tabellen aufbrechen
const clean = s => String(s ?? "").replace(/@/g, "@​").replace(/\s*\n\s*/g, " ").slice(0, 600);

function readReport() {
  let raw;
  try { raw = JSON.parse(readFileSync(input, "utf8")); } catch { return { fehler: "Der Tester hat kein Resultat geliefert." }; }
  const run = Array.isArray(raw) ? raw.find(m => m.type === "result") : raw;
  if (!run) return { fehler: "Der Tester hat kein Resultat geliefert." };
  if (run.is_error) return { fehler: `Der Testlauf ist abgebrochen: ${clean(run.result || run.subtype)}`, run };
  let report = run.structured_output;
  if (!report) {
    const text = String(run.result ?? "");
    try { report = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch {}
  }
  if (!report || !Array.isArray(report.befunde)) return { fehler: "Der Bericht des Testers ist nicht lesbar.", run };
  return { report, run };
}

const { report, run, fehler } = readReport();
const cost = typeof run?.total_cost_usd === "number" ? ` · Kosten: ${run.total_cost_usd.toFixed(2)} USD` : "";
const lines = ["<!-- voci-tester -->", "## Black-Box-Test"];

if (fehler) {
  lines.push("", `🛑 ${fehler}`, "", "Dieser PR gilt als nicht getestet.");
} else {
  const found = ORDER.flatMap(s => report.befunde.filter(b => b.schwere === s));
  const count = s => found.filter(b => b.schwere === s).length;
  lines.push("", clean(report.zusammenfassung), "",
    `**Befunde:** ${ORDER.map(s => `${ICON[s]} ${count(s)} ${s}`).join(" · ")}${cost}`);
  for (const b of found) {
    lines.push("", `### ${ICON[b.schwere]} ${clean(b.titel)}`, `Use Case: ${clean(b.use_case)}`, "");
    (b.schritte || []).forEach((s, i) => lines.push(`${i + 1}. ${clean(s)}`));
    lines.push("", `**Erwartet:** ${clean(b.erwartet)}`, "", `**Tatsächlich:** ${clean(b.tatsaechlich)}`);
    if (b.screenshot) lines.push("", `Screenshot: \`${clean(b.screenshot)}\``);
  }
  if (report.getestet?.length) {
    lines.push("", "<details><summary>Geprüfte Use Cases</summary>", "");
    for (const t of report.getestet) lines.push(`- ${t.ergebnis === "ok" ? "✅" : t.ergebnis === "befund" ? "❌" : "➖"} ${clean(t.use_case)}`);
    lines.push("", "</details>");
  }
  if (report.nicht_getestet?.length) lines.push("", `**Nicht getestet:** ${report.nicht_getestet.map(clean).join("; ")}`);
}
lines.push("", "Screenshots und Rohdaten liegen im Artefakt `bericht` dieses Laufs.");
writeFileSync(output, lines.join("\n").slice(0, 60000) + "\n");

const blockers = report ? report.befunde.filter(b => b.schwere === "blocker").length : 0;
if (fehler || blockers) { console.error(fehler || `${blockers} Blocker gefunden.`); process.exit(1); }
console.log(`Bericht ok: ${report.befunde.length} Befunde, keine Blocker.`);
