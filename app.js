"use strict";

const CFG = window.VOCI_CONFIG || {};
const LANGS = [
  ["en-GB", "Englisch", "eng"], ["fr-FR", "Französisch", "fra"], ["it-IT", "Italienisch", "ita"], ["es-ES", "Spanisch", "spa"],
  ["pt-PT", "Portugiesisch", "por"], ["nl-NL", "Niederländisch", "nld"], ["la", "Latein", "lat"]
];
const langName = c => (LANGS.find(l => l[0] === c) || [, "Fremdsprache"])[1];
const ocrCode = c => (LANGS.find(l => l[0] === c) || [, , "eng"])[2];
const ACCENTS = {
  "fr-FR": "é è ê à â ç ô û ù ï ë œ".split(" "),
  "it-IT": "à è é ì ò ù".split(" "),
  "es-ES": "á é í ó ú ñ ü ¿ ¡".split(" "),
  "pt-PT": "á â ã à ç é ê í ó ô õ ú".split(" "),
  "nl-NL": "é ë ï".split(" ")
};
const EXAMPLE = {
  id: "beispiel", example: true, name: "Beispiel: Englisch, Unit 3", lang: "en-GB",
  words: [["der Hund","the dog"],["die Katze","the cat"],["das Haus","the house"],["gross","big"],["klein","small"],
          ["laufen","to run"],["schwimmen","to swim"],["der Baum","the tree"],["das Fenster","the window"],["glücklich","happy"]]
    .map(([d, f]) => ({ d, f, ok: 0, ko: 0 }))
};
const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const STAR = (on = true) => `<svg class="star ${on ? "on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>`;
const TESSERACT_URL = "vendor/tesseract.min.js";
const ANTHROPIC_URL = "./vendor/anthropic.js";
const MAX_PHOTOS = 5;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- Geräte-Einstellungen (gelten für alle auf diesem Gerät) ---------- */
let prefs = Object.assign({ mode: "choose", dir: "de-fx", rate: 0.9, sound: true }, lsGet("voci-heft-prefs", {}));
const savePrefs = () => lsSet("voci-heft-prefs", prefs);
const getApiKey = () => lsGet("voci-heft-apikey", "");
const setApiKey = k => { try { k ? lsSet("voci-heft-apikey", k) : localStorage.removeItem("voci-heft-apikey"); } catch {} };

/* ---------- Konto & Daten ---------- */
const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
const sb = configured ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
let user = null;           // { id, name, email, local }
let lists = [];
let profile = null;        // { xp, stats, badges }
const emptyProfile = () => ({ xp: 0, stats: { correct: 0, sessions: 0, writeSessions: 0, bestCombo: 0, perfect: 0 }, badges: {} });
const cacheKey = () => "voci-heft-user-" + user.id;
const saveCache = () => lsSet(cacheKey(), { lists, profile, pending: pending });
let pending = { lists: [], deleted: [], profile: false };

/* Daten aus Sicherungsdateien, Server und Zwischenspeicher nie ungeprüft übernehmen.
   Die Grenzen entsprechen den Regeln in datenbank.sql. */
const MAX_WORDS = 1000, MAX_TEXT = 300, MAX_NAME = 120;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const int = (v, max = 1e9) => Math.min(max, Math.max(0, Math.floor(Number(v)) || 0));
const str = (v, max) => (typeof v === "string" ? v : "").slice(0, max);
function normalizeList(l) {
  if (!l || typeof l !== "object" || !ID_RE.test(String(l.id)) || !Array.isArray(l.words)) return null;
  return {
    id: String(l.id),
    name: str(l.name, MAX_NAME),
    lang: LANGS.some(x => x[0] === l.lang) ? l.lang : "",
    words: l.words.filter(w => w && typeof w === "object").slice(0, MAX_WORDS)
      .map(w => ({ d: str(w.d, MAX_TEXT), f: str(w.f, MAX_TEXT), ok: int(w.ok, 1e6), ko: int(w.ko, 1e6) })),
    points: int(l.points), best: int(l.best)
  };
}
function normalizeProfile(p) {
  const out = emptyProfile();
  if (!p || typeof p !== "object") return out;
  out.xp = int(p.xp);
  for (const k of Object.keys(out.stats)) out.stats[k] = int(p.stats?.[k]);
  for (const b of BADGES) if (p.badges?.[b.id]) out.badges[b.id] = typeof p.badges[b.id] === "number" ? p.badges[b.id] : true;
  return out;
}
const normalizeLists = arr => (Array.isArray(arr) ? arr : []).map(normalizeList).filter(Boolean);
const ids = arr => (Array.isArray(arr) ? arr : []).filter(x => ID_RE.test(String(x)));

function startSession(u) {
  user = u;
  const c = lsGet(cacheKey(), null);
  lists = normalizeLists(c?.lists);
  profile = normalizeProfile(c?.profile);
  pending = { lists: ids(c?.pending?.lists), deleted: ids(c?.pending?.deleted), profile: !!c?.pending?.profile };
  go({ name: "home" });
  if (!user.local) pullRemote();
}

async function pullRemote() {
  try {
    await flush();
    const [{ data: rl, error: e1 }, { data: rp, error: e2 }] = await Promise.all([
      sb.from("lists").select("id,name,lang,words,points,best,updated_at").order("updated_at", { ascending: false }),
      sb.from("profiles").select("xp,stats,badges").eq("user_id", user.id).maybeSingle()
    ]);
    if (e1 || e2) throw e1 || e2;
    const keepLocal = new Set(pending.lists);
    lists = [...lists.filter(l => keepLocal.has(l.id)), ...normalizeLists(rl).filter(l => !keepLocal.has(l.id))];
    if (rp && !pending.profile) profile = normalizeProfile(rp);
    else if (!rp) { pending.profile = true; await flush(); }
    saveCache();
    if (view.name === "home") render();
  } catch (e) { console.warn("Laden vom Server fehlgeschlagen", e); }
}

async function flush() {
  if (!user || user.local || !sb) return;
  try {
    for (const id of [...pending.deleted]) {
      const { error } = await sb.from("lists").delete().eq("user_id", user.id).eq("id", id);
      if (error) throw error;
      pending.deleted = pending.deleted.filter(x => x !== id);
    }
    for (const id of [...pending.lists]) {
      const l = normalizeList(lists.find(x => x.id === id));
      if (l) {
        const { error } = await sb.from("lists").upsert({ ...l, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" });
        if (error) throw error;
      }
      pending.lists = pending.lists.filter(x => x !== id);
    }
    if (pending.profile) {
      const p = normalizeProfile(profile);
      const { error } = await sb.from("profiles").upsert({ user_id: user.id, xp: p.xp, stats: p.stats, badges: p.badges, updated_at: new Date().toISOString() });
      if (error) throw error;
      pending.profile = false;
    }
  } catch (e) { console.warn("Synchronisieren später", e); }
  saveCache();
}
window.addEventListener("online", flush);

function persistList(l) { if (!pending.lists.includes(l.id)) pending.lists.push(l.id); saveCache(); flush(); }
function removeList(id) {
  lists = lists.filter(l => l.id !== id);
  pending.lists = pending.lists.filter(x => x !== id);
  pending.deleted.push(id);
  saveCache(); flush();
}
function persistProfile() { pending.profile = true; saveCache(); flush(); }

const shownLists = () => lists.length ? lists : [EXAMPLE];
const getList = id => id === EXAMPLE.id ? EXAMPLE : lists.find(l => l.id === id);

/* ---------- Motivation: Levels, Sterne, Abzeichen ---------- */
const LEVEL_NAMES = ["Wörtli-Entdecker", "Wörtli-Sammler", "Satz-Bastler", "Sprach-Spürnase", "Voci-Profi", "Wort-Akrobat", "Sprach-Held", "Voci-Meister", "Sprach-Legende"];
const xpNeed = n => 50 * n * (n - 1);                    // Level 1: 0, Level 2: 100, Level 3: 300, Level 4: 600 …
const levelOf = xp => { let n = 1; while (xp >= xpNeed(n + 1)) n++; return n; };
const levelName = n => LEVEL_NAMES[Math.min(n - 1, LEVEL_NAMES.length - 1)];
const levelPct = xp => { const n = levelOf(xp); return Math.round((xp - xpNeed(n)) / (xpNeed(n + 1) - xpNeed(n)) * 100); };
const known = w => w.ok > 0 && w.ok >= w.ko;
const listStars = l => { const n = l.words.length; if (!n) return 0; const k = l.words.filter(known).length / n; return k >= 1 ? 3 : k >= 2 / 3 ? 2 : k >= 1 / 3 ? 1 : 0; };

const BADGES = [
  { id: "first_session", name: "Erster Schritt", desc: "Die erste Lernrunde geschafft", test: s => s.sessions >= 1 },
  { id: "first_list", name: "Sammler", desc: "Die erste eigene Liste gespeichert", test: (s, c) => c.lists >= 1 },
  { id: "perfect", name: "Fehlerlos", desc: "Eine ganze Runde ohne Fehler", test: s => s.perfect >= 1 },
  { id: "combo10", name: "Zehnerkette", desc: "10 richtig hintereinander", test: s => s.bestCombo >= 10 },
  { id: "combo25", name: "Unaufhaltbar", desc: "25 richtig hintereinander", test: s => s.bestCombo >= 25 },
  { id: "words100", name: "Hunderter", desc: "100 richtige Antworten", test: s => s.correct >= 100 },
  { id: "words500", name: "Wortschatz", desc: "500 richtige Antworten", test: s => s.correct >= 500 },
  { id: "writer", name: "Schreibprofi", desc: "5 Runden «Schreibe das Wort»", test: s => s.writeSessions >= 5 },
  { id: "master", name: "Drei Sterne", desc: "Alle Wörter einer Liste sitzen", test: (s, c) => c.mastered >= 1 },
  { id: "polyglot", name: "Weltenbummler", desc: "Listen in zwei Sprachen", test: (s, c) => c.langs >= 2 },
  { id: "level5", name: "Voci-Profi", desc: "Level 5 erreicht", test: (s, c) => c.level >= 5 }
];
function checkBadges() {
  const ctx = { lists: lists.length, mastered: lists.filter(l => listStars(l) === 3).length, langs: new Set(lists.map(l => l.lang)).size, level: levelOf(profile.xp) };
  const fresh = BADGES.filter(b => !profile.badges[b.id] && b.test(profile.stats, ctx));
  for (const b of fresh) profile.badges[b.id] = Date.now();
  return fresh;
}
const badgeIcon = (b, on) => `<svg viewBox="0 0 48 48" class="medal ${on ? "on" : ""}" aria-hidden="true">
  <path d="M15 4h8l-4 14h-8z M33 4h-8l4 14h8z" class="ribbon"/>
  <circle cx="24" cy="29" r="15" class="disc"/><circle cx="24" cy="29" r="11" class="ring"/>
  <text x="24" y="34" text-anchor="middle" class="ini">${esc(b.name.split(/\s|-/).map(w => w[0]).join("").slice(0, 2))}</text></svg>`;

/* Lob, Klang und Konfetti */
const PRAISE = ["Super!", "Toll gemacht!", "Genau!", "Bravo!", "Stark!", "Perfekt!", "Läuft bei dir!", "Wow!"];
const COMFORT = ["Fast! Das Wort kommt gleich nochmals.", "Nicht schlimm, Üben macht den Meister.", "Weiter so, beim nächsten Mal klappt's.", "Kein Problem, merk es dir für gleich."];
let audioCtx = null;
function tone(freqs, dur = 0.12, type = "sine", gain = 0.08) {
  if (!prefs.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * dur;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur);
    });
  } catch {}
}
const sfxRight = () => tone([660, 880]);
const sfxWrong = () => tone([220, 180], 0.14, "triangle", 0.06);
const sfxFanfare = () => tone([523, 659, 784, 1047], 0.13, "triangle", 0.09);

function confetti(amount = 140) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.className = "confetti"; document.body.appendChild(c);
  const ctx = c.getContext("2d"), dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const colors = ["--blue", "--red", "--green", "--amber", "--gold"].map(v => css.getPropertyValue(v).trim() || "#2049c9");
  const parts = Array.from({ length: amount }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 4,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, col: pick(colors)
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    }
    if (t - t0 < 2600) requestAnimationFrame(frame); else c.remove();
  })(t0);
}
function toast(html, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind; t.innerHTML = html; t.setAttribute("role", "status");
  $("#toasts").appendChild(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3100);
}
function celebrateBadges(fresh) {
  fresh.forEach((b, i) => setTimeout(() => {
    toast(`${badgeIcon(b, true)}<div><strong>Neues Abzeichen: ${esc(b.name)}</strong><br><span>${esc(b.desc)}</span></div>`, "badge");
    sfxFanfare(); confetti(90);
  }, i * 900));
}

/* ---------- Vorlesen ---------- */
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch {} }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
let sylTimer = null;
// Liest das Fremdwort vor. Ist `el` ein Silben-Element (siehe sylHTML), leuchtet die gesprochene Silbe auf.
function speak(text, lang, el) {
  if (!("speechSynthesis" in window) || !text) return;
  const clean = String(text).replace(/\(.*?\)|\[.*?\]/g, "").replace(/\s*\/\s*/g, ", ").trim();
  const l = lang === "la" ? "it-IT" : lang;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = l;
  const base = l.split("-")[0];
  u.voice = voices.find(v => v.lang === l) || voices.find(v => v.lang.replace("_", "-").startsWith(base)) || null;
  u.rate = prefs.rate;
  clearInterval(sylTimer);
  document.querySelectorAll(".syl.now, .syl.said").forEach(s => s.classList.remove("now", "said"));
  const syls = el ? [...el.querySelectorAll(".syl")] : [];
  if (syls.length) {
    // Die Sprachausgabe meldet keine Silben, darum schreiten wir im Sprechtempo voran (etwa 4 Silben pro Sekunde)
    let i = 0;
    const step = () => {
      if (i > 0) syls[i - 1].classList.replace("now", "said");
      if (i < syls.length) syls[i++].classList.add("now"); else clearInterval(sylTimer);
    };
    const finish = () => { clearInterval(sylTimer); syls.forEach(s => { s.classList.remove("now"); s.classList.add("said"); }); setTimeout(() => syls.forEach(s => s.classList.remove("said")), 900); };
    u.onstart = () => { step(); sylTimer = setInterval(step, 250 / prefs.rate); };
    u.onend = finish;
    u.onerror = finish;
  }
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* ---------- Silbentrennung ---------- */
const HYPHEN_BASE = "vendor/hyphen/";
const HYPHEN_FILES = { "en-GB": ["en-gb", "EnGb"], "fr-FR": ["fr", "Fr"], "it-IT": ["it", "It"], "es-ES": ["es", "Es"], "pt-PT": ["pt", "Pt"], "nl-NL": ["nl", "Nl"], "la": ["la", "La"] };
const hyphenators = {};
async function loadHyphenator(lang) {
  if (lang in hyphenators) return hyphenators[lang];
  const f = HYPHEN_FILES[lang];
  hyphenators[lang] = null;
  if (!f) return null;
  try {
    await loadScript(HYPHEN_BASE + "hyphen.js");
    await loadScript(HYPHEN_BASE + "patterns/" + f[0] + ".js");
    hyphenators[lang] = window.createHyphenator(window["hyphenationPatterns" + f[1]], { hyphenChar: "·", minWordLength: 3 });
  } catch { delete hyphenators[lang]; }
  return hyphenators[lang];
}
/* Die Trennmuster folgen Druckregeln (z. B. «fe·nêtre», «hungry» ungetrennt).
   Für Sprechsilben teilen wir zusätzlich zwischen Vokalgruppen: V·CV, VC·CV, und Konsonantenpaare wie «tr» bleiben zusammen. */
const VOWELS = "aeiouyàâäéèêëïîôöùûüÿáíóúãõœæ";
const ONSETS = new Set(["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "ph", "th", "sh", "gn", "qu", "gu", "wh", "wr", "kn"]);
const ONSETS_ES = new Set(["ll", "rr"]);             // nur Spanisch: ca·lle, pe·rro (Französisch: bel·le)
function speechSyllables(word, lang) {
  const ch = [...word], low = ch.map(c => c.toLowerCase());
  if (ch.length < 4 || ch.some(c => !/\p{L}/u.test(c))) return [word];
  const isV = i => VOWELS.includes(low[i]) && !(low[i] === "u" && /[qg]/.test(low[i - 1] || "") && VOWELS.includes(low[i + 1] || "")) && !(low[i] === "y" && i === 0);
  const groups = [];
  for (let i = 0; i < ch.length; i++) if (isV(i)) { if (groups.length && groups[groups.length - 1][1] === i - 1) groups[groups.length - 1][1] = i; else groups.push([i, i]); }
  // Englisch: stummes e am Ende (make, orange) bildet keine eigene Silbe, «-le» nach Konsonant schon (ta·ble)
  if (lang === "en-GB" && groups.length > 1 && /[^aeiouy]e$/.test(low.join("")) && !/[^aeiouy]le$/.test(low.join(""))) groups.pop();
  if (groups.length < 2) return [word];
  const cuts = [];
  for (let g = 0; g < groups.length - 1; g++) {
    const a = groups[g][1] + 1, b = groups[g + 1][0], n = b - a;
    if (n === 0) continue;                                   // zwei Vokale nebeneinander: nicht trennen
    if (n === 1) { cuts.push(a); continue; }                 // ma·ny
    const pair = low.slice(b - 2, b).join("");
    cuts.push(ONSETS.has(pair) || (lang === "es-ES" && ONSETS_ES.has(pair)) ? b - 2 : b - 1); // fe·nê·tre, hun·gry, bel·le
  }
  const out = []; let last = 0;
  for (const c of cuts) if (c > last && c < ch.length) { out.push(ch.slice(last, c).join("")); last = c; }
  out.push(ch.slice(last).join(""));
  return out;
}
const ROMANCE = new Set(["fr-FR", "it-IT", "es-ES", "pt-PT", "la"]);
function syllabify(word, lang) {
  const h = hyphenators[lang];
  let pieces = [word];
  try { if (h) pieces = h(word).split("·"); } catch {}
  // Englisch: nur Wörter ergänzen, die die Trennmuster gar nicht geteilt haben; romanische Sprachen: alle Teile
  if (!ROMANCE.has(lang) && pieces.length > 1) return pieces;
  return pieces.flatMap(p => {
    const m = p.match(/^(.*['’])(.+)$/u);                    // l'école → l' + école
    return m ? (s => [m[1] + s[0], ...s.slice(1)])(speechSyllables(m[2], lang)) : speechSyllables(p, lang);
  });
}

// Gibt das Wort als Silben aus: <span class="syl">de</span>·<span class="syl">li</span>·<span class="syl">cious</span>
function sylHTML(text, lang) {
  const t = String(text).split(/(\s+|[\/(),])/).map(w => /\p{L}{2}/u.test(w) && !/[\s\/(),]/.test(w) ? syllabify(w, lang).join("·") : w).join("");
  return `<span class="syls" lang="${esc(lang)}">` + t.split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part) || !part) return part;
    return part.split("·").map(s => /\p{L}/u.test(s) ? `<span class="syl">${esc(s)}</span>` : esc(s)).join(`<span class="dot" aria-hidden="true">·</span>`);
  }).join("") + `</span>`;
}

/* ---------- Installieren ---------- */
let installEvent = null;
const INSTALL_VIEWS = ["home", "settings", "login"];
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; if (INSTALL_VIEWS.includes(view.name)) render(); });
window.addEventListener("appinstalled", () => { installEvent = null; if (INSTALL_VIEWS.includes(view.name)) render(); });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
const isMacSafari = () => /macintosh/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/chrome|chromium|edg|firefox/i.test(navigator.userAgent);

// Knopf oder Anleitung, je nachdem, was der Browser kann
function installHTML() {
  if (isStandalone()) return `<p>Das Voci-Heft ist als App installiert. Du findest es auf deinem Startbildschirm.</p>`;
  if (installEvent) return `<p>Mit einem Tipp legst du das Voci-Heft als App auf deinen Startbildschirm. Dann startet es wie jede andere App, auch ohne Internet.</p>
    <div class="row"><button class="primary" data-install>App installieren</button></div>`;
  const steps = isIOS()
    ? ["Tippe unten oder oben auf <b>Teilen</b> (das Viereck mit dem Pfeil nach oben).", "Wähle <b>Zum Home-Bildschirm</b>. Falls du es nicht siehst, scrolle in der Liste nach unten.", "Tippe auf <b>Hinzufügen</b>."]
    : isAndroid()
    ? ["Tippe oben rechts auf das Menü <b>⋮</b>.", "Wähle <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b>.", "Bestätige mit <b>Installieren</b> oder <b>Hinzufügen</b>."]
    : isMacSafari()
    ? ["Klicke oben im Menü auf <b>Ablage</b>.", "Wähle <b>Zum Dock hinzufügen</b>."]
    : ["Klicke in der Adresszeile rechts auf das Symbol <b>Installieren</b>.", "Oder öffne das Menü <b>⋮</b> und wähle <b>App installieren</b>."];
  return `<p>So legst du das Voci-Heft als App auf deinen Startbildschirm. Dann startet es wie jede andere App, auch ohne Internet.</p>
    <ol class="install-steps">${steps.map(s => `<li>${s}</li>`).join("")}</ol>`;
}
function bindInstall(root) {
  root.querySelectorAll("[data-install]").forEach(b => b.onclick = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null; render();
  });
}

/* ---------- Ansichten ---------- */
let view = { name: "loading" };
function go(v) { view = v; render(); window.scrollTo({ top: 0 }); }
function render() {
  const app = $("#app");
  const top = $("#topActions");
  if (!user) top.innerHTML = "";
  else if (view.name === "home") top.innerHTML = `<button class="ghost" id="openSettings">Einstellungen</button><button class="primary" id="newScan">Neue Liste scannen</button>`;
  else top.innerHTML = `<button class="ghost" id="backHome">← Zu den Listen</button>`;
  $("#newScan")?.addEventListener("click", () => go({ name: "edit", list: { id: uid(), name: "", lang: "", words: [] }, isNew: true }));
  $("#openSettings")?.addEventListener("click", () => go({ name: "settings" }));
  $("#backHome")?.addEventListener("click", () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); go({ name: "home" }); });
  ({ loading: a => a.innerHTML = `<p class="muted" style="text-align:center"><span class="spinner"></span></p>`,
     login: renderLogin, recover: renderRecover, home: renderHome, edit: renderEdit, quiz: renderQuiz, done: renderDone, settings: renderSettings })[view.name](app);
}

/* ---------- Anmelden ---------- */
function renderLogin(app) {
  const signup = view.tab === "signup";
  app.innerHTML = `
    <section class="sheet login">
      <div class="stack" style="gap:6px">
        <h2>${signup ? "Konto erstellen" : "Willkommen zurück!"}</h2>
        <p class="muted">${signup ? "Jedes Kind bekommt sein eigenes Konto mit eigenen Listen, Sternen und Abzeichen." : "Melde dich an, um deine Voci zu lernen."}</p>
      </div>
      ${configured ? `
      <div class="seg" role="group" aria-label="Anmelden oder registrieren">
        <button data-tab="login" aria-pressed="${!signup}">Anmelden</button>
        <button data-tab="signup" aria-pressed="${signup}">Konto erstellen</button>
      </div>
      <form id="authForm" class="stack">
        ${signup ? `<div class="field"><label class="label" for="aname">Dein Name</label><input type="text" id="aname" autocomplete="nickname" required maxlength="30"></div>` : ""}
        <div class="field"><label class="label" for="aemail">E-Mail</label><input type="email" id="aemail" autocomplete="email" required></div>
        <div class="field"><label class="label" for="apass">Passwort</label><input type="password" id="apass" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required></div>
        <button class="primary" type="submit" id="authBtn">${signup ? "Konto erstellen" : "Anmelden"}</button>
        ${signup ? "" : `<button type="button" class="ghost" id="forgot">Passwort vergessen?</button>`}
      </form>
      <div id="authStatus"></div>` : `
      <div class="status info">Die Konten sind noch nicht eingerichtet. Folge der Anleitung in der Datei ANLEITUNG.md und trage die Supabase-Angaben in config.js ein.</div>`}
      <button class="ghost" id="tryLocal">Ohne Konto ausprobieren</button>
      <p class="small muted">Ohne Konto bleiben die Listen nur auf diesem Gerät.</p>
    </section>
    ${isStandalone() ? "" : `<details class="sheet install-info"${installEvent ? " open" : ""}>
      <summary>App auf den Startbildschirm</summary>
      ${installHTML()}
    </details>`}`;
  bindInstall(app);
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => go({ name: "login", tab: b.dataset.tab }));
  $("#tryLocal").onclick = () => startSession({ id: "lokal", name: "Gast", local: true });
  const st = (k, h) => $("#authStatus").innerHTML = `<div class="status ${k}">${h}</div>`;
  $("#forgot")?.addEventListener("click", async () => {
    const email = $("#aemail").value.trim();
    if (!email) { st("err", "Gib zuerst deine E-Mail-Adresse ein."); $("#aemail").focus(); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    st(error ? "err" : "ok", error ? "Das hat nicht geklappt. Prüfe die E-Mail-Adresse." : "Wir haben dir eine E-Mail geschickt. Klicke auf den Link darin, um ein neues Passwort zu wählen.");
  });
  $("#authForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("#authBtn"); btn.disabled = true;
    const email = $("#aemail").value.trim(), password = $("#apass").value;
    try {
      if (signup) {
        const name = $("#aname").value.trim();
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) { st("ok", "Fast geschafft! Wir haben dir eine E-Mail geschickt. Bestätige deine Adresse und melde dich dann an."); btn.disabled = false; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const m = String(err?.message || "");
      st("err", /invalid login/i.test(m) ? "E-Mail oder Passwort stimmt nicht."
        : /already registered/i.test(m) ? "Mit dieser E-Mail gibt es schon ein Konto. Melde dich an."
        : /not confirmed/i.test(m) ? "Bestätige zuerst deine E-Mail-Adresse. Schau in deinem Posteingang nach."
        : /password/i.test(m) ? "Das Passwort braucht mindestens 8 Zeichen."
        : navigator.onLine ? "Das hat nicht geklappt. Versuche es nochmals." : "Zum Anmelden braucht es Internet.");
      btn.disabled = false;
    }
  });
}
function renderRecover(app) {
  app.innerHTML = `<section class="sheet login">
    <h2>Neues Passwort</h2>
    <form id="recForm" class="stack">
      <div class="field"><label class="label" for="npass">Neues Passwort</label><input type="password" id="npass" autocomplete="new-password" minlength="8" required></div>
      <button class="primary" type="submit">Passwort speichern</button>
    </form><div id="recStatus"></div></section>`;
  $("#recForm").onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $("#npass").value });
    $("#recStatus").innerHTML = error ? `<div class="status err">Das hat nicht geklappt. Wähle ein Passwort mit mindestens 8 Zeichen.</div>` : "";
    if (!error) { toast("<strong>Passwort geändert</strong>"); go({ name: "home" }); }
  };
}
const userFrom = u => ({ id: u.id, email: u.email, name: str(u.user_metadata?.name, 30) || (u.email || "").split("@")[0].slice(0, 30) });

/* ---------- Startseite ---------- */
function renderHome(app) {
  const ls = shownLists();
  const lvl = levelOf(profile.xp);
  const totalStars = lists.reduce((s, l) => s + listStars(l), 0);
  const earned = BADGES.filter(b => profile.badges[b.id]).length;
  const showInstall = !isStandalone() && (installEvent || isIOS() || isAndroid());
  app.innerHTML = `
    <section class="sheet player">
      <div class="avatar" aria-hidden="true">${esc((user.name || "?").slice(0, 1).toUpperCase())}</div>
      <div class="stack" style="gap:6px;flex:1;min-width:0">
        <div class="row between">
          <strong class="pname">Hoi ${esc(user.name)}!</strong>
          <span class="chip level">Level ${lvl}</span>
        </div>
        <span class="small muted">${esc(levelName(lvl))} · ${profile.xp} Punkte · noch ${xpNeed(lvl + 1) - profile.xp} bis Level ${lvl + 1}</span>
        <div class="bar xp"><i style="width:${levelPct(profile.xp)}%"></i></div>
        <div class="row small muted" style="gap:14px"><span class="inline-stat">${STAR()} ${totalStars} Sterne</span><span>${earned} von ${BADGES.length} Abzeichen</span></div>
      </div>
    </section>
    ${showInstall ? `<section class="sheet install-hint">
      <div class="row between">
        <span>Lege das Voci-Heft als App auf deinen Startbildschirm.</span>
        ${installEvent ? `<button class="primary" data-install>App installieren</button>` : `<button class="primary" id="installHow">So geht's</button>`}
      </div></section>` : ""}
    <section class="sheet">
      <div class="stack">
        <span class="label">So lernst du</span>
        <div class="row">
          <div class="seg" role="group" aria-label="Lernmodus">
            <button data-mode="choose" aria-pressed="${prefs.mode === "choose"}">Wähle ein Wort</button>
            <button data-mode="write" aria-pressed="${prefs.mode === "write"}">Schreibe das Wort</button>
          </div>
          <div class="seg" role="group" aria-label="Richtung">
            <button data-dir="de-fx" aria-pressed="${prefs.dir === "de-fx"}">Deutsch → Fremdsprache</button>
            <button data-dir="fx-de" aria-pressed="${prefs.dir === "fx-de"}">Fremdsprache → Deutsch</button>
          </div>
        </div>
        <p class="small muted">${prefs.mode === "write" ? "Schreiben gibt 15 Punkte pro Wort." : "Wählen gibt 10 Punkte pro Wort, Schreiben sogar 15."} Punkte gibt es pro Runde einmal pro Wort, wenn es beim ersten Versuch sitzt. Alle 5 richtig hintereinander gibt es 10 Bonuspunkte.</p>
      </div>
    </section>
    <section class="lists">
      ${ls.map(l => {
        const n = l.words.length, k = l.words.filter(known).length, s = listStars(l);
        return `<article class="list-card">
          <div class="row between">
            <h3>${esc(l.name || "Ohne Namen")}</h3>
            <div class="meta"><span class="stars" aria-label="${s} von 3 Sternen">${STAR(s >= 1)}${STAR(s >= 2)}${STAR(s >= 3)}</span><span class="chip">${esc(langName(l.lang))}</span>${l.example ? '<span class="chip example">Beispiel</span>' : ""}</div>
          </div>
          <p class="preview">${l.words.slice(0, 5).map(w => esc(w.f)).join(" · ")}${n > 5 ? " …" : ""}</p>
          <div class="stack" style="gap:4px">
            <div class="bar"><i style="width:${n ? Math.round(k / n * 100) : 0}%"></i></div>
            <span class="small muted">${k} von ${n} Wörtern sitzen${s < 3 && n ? ` · noch ${Math.ceil([1 / 3, 2 / 3, 1][s] * n) - k} bis zum nächsten Stern` : s === 3 ? " · gemeistert!" : ""}</span>
          </div>
          <div class="list-points small"><span class="inline-stat">${STAR()} <b>${l.points || 0}</b>&nbsp;Punkte in diesem Voci-Satz</span>${l.best ? `<span class="muted">Rekord pro Runde: <b>${l.best}</b></span>` : ""}</div>
          <div class="row">
            <button class="primary" data-learn="${esc(l.id)}" ${n < 2 ? "disabled" : ""}>Lernen</button>
            ${l.words.some(w => w.ko > w.ok) ? `<button data-learn-hard="${esc(l.id)}">Nur schwierige</button>` : ""}
            ${l.example ? "" : `<button class="ghost" data-edit="${esc(l.id)}">Bearbeiten</button>`}
          </div>
        </article>`;
      }).join("")}
    </section>
    ${lists.length ? "" : `<p class="small muted" style="text-align:center">Das ist eine Beispiel-Liste. Scanne deine eigenen Voci mit „Neue Liste scannen“.</p>`}
    <section class="sheet">
      <div class="row between"><h3>Abzeichen</h3><span class="small muted">${earned} von ${BADGES.length}</span></div>
      <div class="badges">${BADGES.map(b => `<div class="badge ${profile.badges[b.id] ? "on" : ""}" title="${esc(b.desc)}">${badgeIcon(b, !!profile.badges[b.id])}<span class="bname">${esc(b.name)}</span><span class="bdesc">${esc(b.desc)}</span></div>`).join("")}</div>
    </section>`;

  bindInstall(app);
  $("#installHow")?.addEventListener("click", () => { go({ name: "settings" }); $("#installInfo")?.scrollIntoView({ block: "start" }); });
  app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { prefs.mode = b.dataset.mode; savePrefs(); render(); });
  app.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => { prefs.dir = b.dataset.dir; savePrefs(); render(); });
  app.querySelectorAll("[data-learn]").forEach(b => b.onclick = () => startQuiz(b.dataset.learn, false));
  app.querySelectorAll("[data-learn-hard]").forEach(b => b.onclick = () => startQuiz(b.dataset.learnHard, true));
  app.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    go({ name: "edit", list: JSON.parse(JSON.stringify(getList(b.dataset.edit))), isNew: false });
  });
}

/* ---------- Einstellungen ---------- */
function renderSettings(app) {
  const key = getApiKey();
  app.innerHTML = `
    <section class="sheet">
      <h2>Mein Konto</h2>
      <p>${user.local ? "Du lernst ohne Konto. Deine Listen bleiben nur auf diesem Gerät." : `Angemeldet als <strong>${esc(user.name)}</strong> (${esc(user.email)}). Deine Listen und Punkte sind auf jedem Gerät da, auf dem du dich anmeldest.`}</p>
      <div class="row"><button id="logout">${user.local ? "Zur Anmeldung" : "Abmelden"}</button></div>
    </section>
    <section class="sheet" id="installInfo">
      <h2>App auf den Startbildschirm</h2>
      ${installHTML()}
    </section>
    <section class="sheet">
      <h2>Vorlesen und Klänge</h2>
      <div class="settings">
        <label for="rate">Vorlese-Tempo</label>
        <input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="${prefs.rate}">
        <button class="ghost" id="testVoice">Probe hören</button>
      </div>
      <label class="row" style="gap:8px"><input type="checkbox" id="sound" ${prefs.sound ? "checked" : ""}> Klänge bei richtigen und falschen Antworten</label>
    </section>
    <section class="sheet">
      <h2>Fotos auslesen</h2>
      <p>Ohne weitere Einstellung liest die App Fotos direkt auf deinem Gerät. Das klappt gut bei gedruckten Listen mit zwei Spalten. Bei Handschrift oder komplizierten Seiten erkennt Claude die Wörter viel besser.</p>
      <p class="small muted">Für Claude brauchst du einen eigenen API-Schlüssel von console.anthropic.com. Ein Scan kostet etwa 2 bis 5 Rappen. Der Schlüssel bleibt nur auf diesem Gerät gespeichert und wird nur an Anthropic gesendet.</p>
      <div class="field"><label class="label" for="apikey">Claude API-Schlüssel</label>
        <div class="key-row"><input type="password" id="apikey" placeholder="sk-ant-…" value="${esc(key)}" autocomplete="off">
          <button class="primary" id="saveKey">Speichern</button>
          ${key ? `<button class="danger" id="delKey">Entfernen</button>` : ""}</div></div>
      <div id="keyStatus">${key ? `<div class="status ok">Claude ist eingerichtet. Neue Scans laufen über Claude.</div>` : ""}</div>
    </section>
    <section class="sheet">
      <h2>Sicherung</h2>
      <p>Lade deine Listen als Datei herunter oder lade eine Sicherung wieder hinein.</p>
      <div class="row">
        <button id="exportBtn" ${lists.length ? "" : "disabled"}>Sicherung herunterladen</button>
        <label class="btn">Sicherung laden<input type="file" id="importFile" accept="application/json,.json"></label>
      </div>
      <div id="backupStatus"></div>
    </section>`;
  bindInstall(app);
  $("#logout").onclick = async () => {
    if (!user.local && sb) { await flush(); await sb.auth.signOut(); }
    user = null; go({ name: "login" });
  };
  $("#rate").oninput = e => { prefs.rate = +e.target.value; savePrefs(); };
  $("#testVoice").onclick = () => speak("Hello! Bonjour! Ciao!", "en-GB");
  $("#sound").onchange = e => { prefs.sound = e.target.checked; savePrefs(); if (prefs.sound) sfxRight(); };
  $("#saveKey").onclick = () => {
    const v = $("#apikey").value.trim();
    if (v && !v.startsWith("sk-ant-")) { $("#keyStatus").innerHTML = `<div class="status err">Das sieht nicht wie ein Claude-Schlüssel aus. Er beginnt mit „sk-ant-“.</div>`; return; }
    setApiKey(v); renderSettings(app);
  };
  $("#delKey")?.addEventListener("click", () => { setApiKey(""); renderSettings(app); });
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "voci-heft", version: 1, lists }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `voci-heft-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $("#importFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (f.size > 5e6) throw new Error("zu gross");
      const data = JSON.parse(await f.text());
      const incoming = normalizeLists(data?.lists).filter(l => l.id !== EXAMPLE.id);
      if (!incoming.length) throw new Error();
      for (const l of incoming) { const i = lists.findIndex(x => x.id === l.id); if (i >= 0) lists[i] = l; else lists.push(l); persistList(l); }
      $("#backupStatus").innerHTML = `<div class="status ok">${incoming.length} Listen geladen.</div>`;
    } catch {
      $("#backupStatus").innerHTML = `<div class="status err">Diese Datei ist keine Voci-Heft-Sicherung.</div>`;
    }
  };
}

/* ---------- Erfassen & Bearbeiten ---------- */
function renderEdit(app, keepStatus) {
  const L = view.list;
  const photos = view.photos || [];
  const useClaude = !!getApiKey();
  if (!useClaude && !L.lang) L.lang = "en-GB";
  app.innerHTML = `
    <section class="sheet">
      <h2>${view.isNew ? "Neue Voci-Liste" : "Liste bearbeiten"}</h2>
      <div class="row">
        <div class="field"><label class="label" for="lname">Name der Liste</label>
          <input type="text" id="lname" placeholder="z. B. Englisch Unit 4" maxlength="${MAX_NAME}" value="${esc(L.name)}"></div>
        <div class="field"><label class="label" for="llang">Fremdsprache</label>
          <select id="llang">
            ${useClaude ? `<option value="" ${!L.lang ? "selected" : ""}>Automatisch erkennen</option>` : ""}
            ${LANGS.map(([c, n]) => `<option value="${c}" ${L.lang === c ? "selected" : ""}>${n}</option>`).join("")}
          </select></div>
      </div>
      <div class="drop" id="drop">
        <h3>Fotos von deinen Voci</h3>
        <p class="small muted">Fotografiere die Seite im Heft oder Buch. Gut lesbar, gerade und hell gibt die besten Resultate. Bis zu ${MAX_PHOTOS} Fotos aufs Mal.</p>
        <div class="row" style="justify-content:center">
          <label class="btn">Foto aufnehmen<input type="file" id="cam" accept="image/*" capture="environment"></label>
          <label class="btn">Bild auswählen<input type="file" id="pick" accept="image/*" multiple></label>
        </div>
        ${photos.length ? `<div class="thumbs">${photos.map(p => `<img src="${p.url}" alt="Foto">`).join("")}</div>
          <div class="row" style="justify-content:center"><button class="primary" id="scan">Wörter herauslesen</button><button class="ghost" id="clearPhotos">Fotos entfernen</button></div>` : ""}
        <p class="small muted">${useClaude ? "Fotos werden mit Claude ausgelesen." : `Fotos werden auf diesem Gerät ausgelesen. Für Handschrift kannst du in den Einstellungen Claude einrichten.`}</p>
      </div>
      <div id="status"></div>
    </section>
    <section class="sheet">
      <div class="row between"><h3>Wörter (${L.words.length})</h3><button class="ghost" id="addRow">+ Wort hinzufügen</button></div>
      <div class="pair-head"><span class="label">Deutsch</span><span class="label" id="fxHead">${esc(L.lang ? langName(L.lang) : "Fremdsprache")}</span><span></span></div>
      <div class="pairs" id="pairs">
        ${L.words.map((w, i) => `<div class="pair${view.newFrom != null && i >= view.newFrom ? " new" : ""}">
          <input type="text" aria-label="Deutsch ${i + 1}" id="d${i}" data-i="${i}" data-k="d" maxlength="${MAX_TEXT}" value="${esc(w.d)}">
          <input type="text" aria-label="Fremdwort ${i + 1}" id="f${i}" data-i="${i}" data-k="f" maxlength="${MAX_TEXT}" value="${esc(w.f)}">
          <button aria-label="Wort entfernen" data-del="${i}">✕</button></div>`).join("")}
      </div>
      ${L.words.length ? `<button class="ghost" id="swapAll" style="align-self:flex-start">Spalten tauschen</button>` : `<p class="muted small">Noch keine Wörter. Scanne ein Foto oder tippe sie ein.</p>`}
      <div class="row between">
        ${view.isNew ? "<span></span>" : `<button class="danger" id="delList">Liste löschen</button>`}
        <button class="primary" id="saveList" ${L.words.filter(w => w.d.trim() && w.f.trim()).length < 2 ? "disabled" : ""}>Liste speichern</button>
      </div>
    </section>`;

  if (keepStatus && view.status) setStatus(view.status.kind, view.status.html);
  $("#lname").oninput = e => L.name = e.target.value;
  $("#llang").onchange = e => { L.lang = e.target.value; $("#fxHead").textContent = L.lang ? langName(L.lang) : "Fremdsprache"; };
  $("#pairs").oninput = e => {
    const t = e.target; if (!t.dataset.k) return;
    L.words[+t.dataset.i][t.dataset.k] = t.value;
    $("#saveList").disabled = L.words.filter(w => w.d.trim() && w.f.trim()).length < 2;
  };
  app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { L.words.splice(+b.dataset.del, 1); renderEdit(app, true); });
  $("#addRow").onclick = () => { L.words.push({ d: "", f: "", ok: 0, ko: 0 }); renderEdit(app, true); $("#d" + (L.words.length - 1))?.focus(); };
  $("#swapAll")?.addEventListener("click", () => { L.words = L.words.map(w => ({ ...w, d: w.f, f: w.d })); renderEdit(app, true); });
  const addFiles = files => {
    view.photos = [...(view.photos || []), ...[...files].filter(f => f.type.startsWith("image/")).map(f => ({ file: f, url: URL.createObjectURL(f) }))].slice(0, MAX_PHOTOS);
    view.status = null; renderEdit(app);
  };
  $("#cam").onchange = e => addFiles(e.target.files);
  $("#pick").onchange = e => addFiles(e.target.files);
  const drop = $("#drop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); };
  $("#clearPhotos")?.addEventListener("click", () => { view.photos = []; renderEdit(app); });
  $("#scan")?.addEventListener("click", () => useClaude ? scanWithClaude() : scanOnDevice());
  $("#saveList").onclick = () => {
    L.words = L.words.map(w => ({ ...w, d: w.d.trim(), f: w.f.trim() })).filter(w => w.d && w.f);
    if (!L.lang) L.lang = "en-GB";
    if (!L.name.trim()) L.name = langName(L.lang) + " " + new Date().toLocaleDateString("de-CH");
    const i = lists.findIndex(l => l.id === L.id);
    if (i >= 0) lists[i] = L; else lists.unshift(L);
    persistList(L);
    const fresh = checkBadges();
    if (fresh.length) persistProfile();
    const wasNew = view.isNew;
    go({ name: "home" });
    toast(`<strong>Liste gespeichert!</strong> ${wasNew ? `${L.words.length} Wörter warten auf dich.` : ""}`);
    celebrateBadges(fresh);
  };
  const del = $("#delList");
  if (del) del.onclick = () => {
    if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "Wirklich löschen?"; return; }
    removeList(L.id); go({ name: "home" });
  };
}

function setStatus(kind, html) {
  view.status = kind ? { kind, html } : null;
  const s = $("#status"); if (!s) return;
  s.innerHTML = kind ? `<div class="status ${kind}">${html}</div>` : "";
}

// Nach dem Scan direkt zur Wortliste springen, damit man die erkannten Wörter prüfen und korrigieren kann
function showNewRows() {
  const first = document.querySelector(".pair.new") || $("#pairs");
  first?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}

function addPairs(pairs) {
  const L = view.list;
  const seen = new Set(L.words.map(w => (w.d + "|" + w.f).toLowerCase()));
  let added = 0;
  for (const p of pairs) {
    const d = String(p.de).trim(), f = String(p.fx).trim();
    const key = (d + "|" + f).toLowerCase();
    if (!d || !f || seen.has(key)) continue;
    seen.add(key);
    L.words.push({ d, f, ok: 0, ko: 0 }); added++;
  }
  return added;
}

async function shrink(file, max = 1800) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(b => r(b || file), "image/jpeg", 0.85));
}
const blobToBase64 = b => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(b);
});
const loadScript = src => new Promise((res, rej) => {
  if ([...document.scripts].some(s => s.src === new URL(src, location.href).href)) return res();
  const s = document.createElement("script");
  s.src = src; s.onload = res; s.onerror = () => rej(new Error("load"));
  document.head.appendChild(s);
});

/* Auf dem Gerät: Texterkennung mit Tesseract, danach Zeilen in Wortpaare zerlegen */
let ocrWorker = null, ocrLangs = "";
async function scanOnDevice() {
  const L = view.list, btn = $("#scan");
  btn.disabled = true;
  const lang = L.lang || "en-GB";
  const progress = pct => setStatus("info", `<span class="spinner"></span> Fotos werden gelesen … ${pct}%<div class="progress-ocr"><i style="width:${pct}%"></i></div>`);
  progress(0);
  try {
    await loadScript(TESSERACT_URL);
    const langs = "deu+" + ocrCode(lang);
    let current = 0;
    const total = view.photos.length;
    if (!ocrWorker || ocrLangs !== langs) {
      if (ocrWorker) await ocrWorker.terminate();
      setStatus("info", `<span class="spinner"></span> Lade die Texterkennung (nur beim ersten Mal) …`);
      ocrWorker = await Tesseract.createWorker(langs, 1, {
        workerPath: new URL("vendor/tesseract-worker.min.js", location.href).href,
        corePath: new URL("vendor/tesseract-core", location.href).href, workerBlobURL: false,
        logger: m => { if (m.status === "recognizing text") progress(Math.round(((current + m.progress) / total) * 100)); }
      });
      await ocrWorker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "300" });
      ocrLangs = langs;
    }
    let text = "", rows = [];
    for (const p of view.photos) {
      const img = await prepareForOcr(p.file);
      const { data } = await ocrWorker.recognize(img, {}, { text: true, blocks: true });
      text += data.text + "\n";
      rows.push(...rowsFromBlocks(data.blocks));
      current++;
    }
    const pairs = parsePairs(rows.length ? rows : textRows(text), lang);
    if (!pairs.length) {
      view.status = { kind: "err", html: `Es wurden keine Wortpaare erkannt. Fotografiere näher, gerade und hell. Oder richte in den Einstellungen Claude ein, das kann auch Handschrift lesen.${rawBox(text)}` };
      renderEdit($("#app"), true); return;
    }
    view.newFrom = L.words.length;
    const added = addPairs(pairs);
    view.photos = [];
    view.status = { kind: "ok", html: `${added} Wörter erkannt und unten gelb markiert. Tippe auf ein Wort, um es zu korrigieren, und speichere dann die Liste.${rawBox(text)}` };
    renderEdit($("#app"), true);
    showNewRows();
  } catch (e) {
    console.error(e);
    setStatus("err", navigator.onLine ? "Das Auslesen hat nicht geklappt. Versuche es nochmals mit einem schärferen Foto." : "Beim ersten Scan braucht die App Internet, um die Texterkennung zu laden.");
    btn.disabled = false;
  }
}
const rawBox = t => t.trim() ? `<details style="margin-top:8px"><summary>Erkannten Text anzeigen</summary><textarea class="ocr-raw" readonly>${esc(t.trim())}</textarea></details>` : "";

const GERMAN_HINT = /\b(der|die|das|ein|eine|einen|sich|und|nicht)\b|[äöüß]/i;
const FOREIGN_HINT = {
  "en-GB": /\b(the|to|a|an|of|is)\b/i,
  "fr-FR": /\b(le|la|les|un|une|des|du|se)\b|\bl'|[éèêàâçôû]/i,
  "it-IT": /\b(il|lo|la|gli|le|un|una|uno|di)\b|\bl'|[àèìòù]/i,
  "es-ES": /\b(el|la|los|las|un|una|de)\b|[áéíóúñ¿¡]/i,
  "pt-PT": /\b(o|a|os|as|um|uma|de)\b|[ãõçâêô]/i,
  "nl-NL": /\b(de|het|een|te)\b/i,
  "la": /\b(est|sunt|et)\b|(us|um|ae|is)\b/i
};
/* Foto für die Texterkennung aufbereiten: Graustufen und Kontrast strecken, damit Schatten und graues Papier verschwinden */
async function prepareForOcr(file) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, 2400 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const id = ctx.getImageData(0, 0, c.width, c.height), px = id.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0;
    px[i] = g; hist[g]++;
  }
  // 1 % dunkelste und 5 % hellste Pixel als Schwarz- und Weisspunkt
  const n = px.length / 4;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < n * 0.01) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) < n * 0.05) hi--;
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, (px[i] - lo) * 255 / span));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(id, 0, 0);
  return new Promise(r => c.toBlob(b => r(b || file), "image/png"));
}

/* Eine Zeile in Spalten teilen: dort, wo zwischen zwei Wörtern eine grosse Lücke ist */
function rowsFromBlocks(blocks) {
  const rows = [];
  for (const b of blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const words = (l.words || []).filter(w => w.text.trim());
    if (!words.length) continue;
    const h = Math.max(8, l.bbox.y1 - l.bbox.y0);
    const cells = [[words[0]]];
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].bbox.x0 - words[i - 1].bbox.x1;
      if (gap > h * 1.3) cells.push([]);
      cells[cells.length - 1].push(words[i]);
    }
    rows.push(cells.map(ws => ws.map(w => w.text).join(" ")));
  }
  return rows;
}
// Ersatz, falls keine Positionen vorliegen: an Gedankenstrichen, Gleichheitszeichen oder mehreren Leerzeichen teilen
const textRows = text => text.split(/\r?\n/).map(line => line.split(/\s+[-–—=:]+\s+|\s*=\s*|\t+|\s{3,}|\s+\|\s+/));

const PHONETIC = /^[\[\/(].*[\]\/)]$|[ˈˌəɪʊɒʌæɜɔŋθðʃʒː]/;
function cleanCell(s) {
  return s.replace(/^[\s\d.)•·*|-]+(?=\p{L})/u, "")   // Nummerierung und Aufzählungszeichen
          .replace(/\s*\[[^\]]*\]\s*/g, " ")            // Lautschrift wie [dɒg]
          .replace(/\s*\/[^\/\s]*[ˈˌəɪʊɒʌæɜɔŋθðʃʒː][^\/]*\/\s*/g, " ") // Lautschrift wie /dɒg/
          .replace(/[|_]+/g, " ").replace(/\s{2,}/g, " ")
          .replace(/^[;,.:\s]+|[;,.:\s]+$/g, "").trim();
}
function parsePairs(rows, lang) {
  const raw = [];
  for (const row of rows) {
    let cells = row.map(cleanCell).filter(c => /\p{L}{2}/u.test(c) && !PHONETIC.test(c));
    if (cells.length > 2) {
      // Drei Spalten (z. B. Wort, Lautschrift, Übersetzung oder Wort, Übersetzung, Beispielsatz): Sätze weglassen
      const short = cells.filter(c => c.split(" ").length <= 5);
      cells = short.length >= 2 ? short : cells;
      cells = [cells[0], cells[cells.length - 1]];
    }
    if (cells.length !== 2) continue;
    raw.push(cells);
  }
  const fx = FOREIGN_HINT[lang] || /$^/;
  const score = s => (GERMAN_HINT.test(s) ? 1 : 0) - (fx.test(s) ? 1 : 0);
  const leftIsGerman = raw.reduce((sum, [a, b]) => sum + score(a) - score(b), 0) >= 0;
  // Auf der deutschen Seite gibt es keine französischen Akzente: ô → ö, û → ü, â → ä
  const fixDe = s => s.replace(/ô/g, "ö").replace(/û/g, "ü").replace(/â/g, "ä").replace(/Ô/g, "Ö").replace(/Û/g, "Ü").replace(/Â/g, "Ä");
  return raw.map(([a, b]) => leftIsGerman ? { de: fixDe(a), fx: b } : { de: fixDe(b), fx: a });
}

/* Mit Claude: das Bild direkt verstehen lassen, auch Handschrift */
const PAIR_SCHEMA = {
  type: "object",
  properties: {
    language: { type: "string", enum: LANGS.map(l => l[0]) },
    title: { type: "string" },
    pairs: {
      type: "array",
      items: {
        type: "object",
        properties: { de: { type: "string" }, fx: { type: "string" } },
        required: ["de", "fx"],
        additionalProperties: false
      }
    }
  },
  required: ["language", "title", "pairs"],
  additionalProperties: false
};
async function scanWithClaude() {
  const L = view.list, btn = $("#scan");
  btn.disabled = true;
  setStatus("info", `<span class="spinner"></span> Claude liest deine Voci …`);
  let Anthropic;
  try {
    ({ default: Anthropic } = await import(ANTHROPIC_URL));
  } catch {
    setStatus("err", "Für Claude braucht die App eine Internetverbindung."); btn.disabled = false; return;
  }
  try {
    const images = await Promise.all(view.photos.map(async p => blobToBase64(await shrink(p.file))));
    const hint = L.lang ? `Die Fremdsprache ist ${langName(L.lang)} (${L.lang}).` : "Erkenne die Fremdsprache selbst.";
    const prompt = `${images.length > 1 ? "Die Bilder zeigen" : "Das Bild zeigt"} eine Vokabelliste aus der Schule (Heft, Lehrbuch oder Arbeitsblatt). Ein Teil ist Deutsch, der andere eine Fremdsprache. ${hint}
Lies alle Wortpaare heraus, in der Reihenfolge auf der Seite. "de" ist immer das deutsche Wort, "fx" das Wort in der Fremdsprache.
- Übernimm die Schreibweise genau, mit Akzenten und Gross-/Kleinschreibung.
- Behalte Artikel und Zusätze wie "to" bei Verben, so wie sie dastehen.
- Hat ein Wort mehrere Bedeutungen, trenne sie mit " / ".
- Ignoriere Überschriften, Seitenzahlen, Lautschrift und Beispielsätze.
- "title" ist ein kurzer Titel wie "Unit 4", falls er auf der Seite steht, sonst ein leerer Text.`;
    const client = new Anthropic({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: PAIR_SCHEMA } },
      messages: [{
        role: "user",
        content: [
          ...images.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
          { type: "text", text: prompt }
        ]
      }]
    });
    if (msg.stop_reason === "refusal") throw { voci: "Claude konnte dieses Bild nicht verarbeiten. Versuche ein anderes Foto." };
    const res = JSON.parse(msg.content.find(b => b.type === "text")?.text || "{}");
    const pairs = (res.pairs || []).filter(p => p?.de && p?.fx);
    if (!pairs.length) { setStatus("err", "Auf dem Foto wurden keine Wortpaare gefunden. Fotografiere die Liste näher und heller und versuche es nochmals."); btn.disabled = false; return; }
    if (!L.lang && LANGS.some(l => l[0] === res.language)) L.lang = res.language;
    if (!L.name && res.title) L.name = res.title;
    view.newFrom = L.words.length;
    const added = addPairs(pairs);
    view.photos = [];
    view.status = { kind: "ok", html: `${added} Wörter erkannt (${esc(langName(L.lang))}) und unten gelb markiert. Tippe auf ein Wort, um es zu korrigieren, und speichere dann die Liste.` };
    renderEdit($("#app"), true);
    showNewRows();
  } catch (e) {
    console.error(e);
    let msg = e?.voci;
    if (!msg) {
      if (e instanceof Anthropic.AuthenticationError) msg = "Der API-Schlüssel stimmt nicht. Prüfe ihn in den Einstellungen.";
      else if (e instanceof Anthropic.PermissionDeniedError) msg = "Dieser API-Schlüssel darf Claude nicht nutzen. Prüfe dein Konto auf console.anthropic.com.";
      else if (e instanceof Anthropic.RateLimitError) msg = "Gerade zu viele Anfragen. Warte einen Moment und versuche es dann nochmals.";
      else if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) msg = "Auf deinem Anthropic-Konto ist kein Guthaben mehr.";
      else if (e instanceof Anthropic.APIConnectionError) msg = "Keine Verbindung zu Claude. Prüfe das Internet.";
    }
    setStatus("err", msg || "Das Auslesen hat nicht geklappt. Versuche es nochmals oder mit einem schärferen Foto.");
    btn.disabled = false;
  }
}

/* ---------- Lernen ---------- */
let quiz = null;
function newQuiz(listId, idx) {
  return { listId, queue: shuffle(idx), total: idx.length, done: 0, firstTry: new Set(), missed: new Set(), current: null, answered: false,
           xp: 0, combo: 0, bestCombo: 0, correct: 0, startLevel: levelOf(profile.xp), mode: prefs.mode };
}
async function startQuiz(id, hardOnly) {
  const list = getList(id);
  await Promise.race([loadHyphenator(list.lang), new Promise(r => setTimeout(r, 2500))]);
  let idx = list.words.map((_, i) => i);
  if (hardOnly) idx = idx.filter(i => list.words[i].ko > list.words[i].ok);
  if (!idx.length) idx = list.words.map((_, i) => i);
  quiz = newQuiz(id, idx);
  go({ name: "quiz" });
}

const norm = s => String(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/[.,!?;:"'’]/g, "").replace(/ß/g, "ss").replace(/\s+/g, " ").trim();
const variants = s => [s, ...String(s).split(/\s*[\/;,]\s*/)].map(norm).filter(Boolean);
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function checkTyped(input, target) {
  const a = norm(input), vs = variants(target);
  if (!a) return "wrong";
  if (vs.includes(a)) return "right";
  if (vs.some(v => v.length > 3 && lev(a, v) === 1)) return "almost";
  return "wrong";
}

function renderQuiz(app) {
  const list = getList(quiz.listId);
  if (!quiz.queue.length) return finishQuiz();
  const wi = quiz.queue[0], w = list.words[wi];
  const toFx = prefs.dir === "de-fx";
  const ask = toFx ? w.d : w.f, sol = toFx ? w.f : w.d;
  quiz.current = wi; quiz.answered = false;
  const pct = Math.round(quiz.done / quiz.total * 100);
  let body;
  if (quiz.mode === "choose") {
    const others = shuffle(list.words.map((x, i) => i).filter(i => i !== wi && norm(toFx ? list.words[i].f : list.words[i].d) !== norm(sol))).slice(0, 3);
    const opts = shuffle([wi, ...others]);
    body = `<div class="choices">${opts.map(i => `<button data-opt="${i}">${esc(toFx ? list.words[i].f : list.words[i].d)}</button>`).join("")}</div>`;
  } else {
    const acc = toFx ? (ACCENTS[list.lang] || []) : [];
    body = `<form id="wform" class="stack" autocomplete="off">
      <input type="text" id="answer" class="answer-input" placeholder="${toFx ? esc(langName(list.lang)) + " eintippen" : "Deutsch eintippen"}" autocapitalize="off" spellcheck="false" aria-label="Deine Antwort">
      ${acc.length ? `<div class="accents">${acc.map(a => `<button type="button" data-acc="${a}">${a}</button>`).join("")}</div>` : ""}
      <button class="primary" type="submit" id="check">Prüfen</button></form>`;
  }
  app.innerHTML = `
    <section class="sheet quiz">
      <div class="progress"><div class="bar"><i style="width:${pct}%"></i></div><span class="count">${quiz.done} / ${quiz.total}</span></div>
      <div class="hud">
        <span class="inline-stat">${STAR()} <b id="hudXp">${quiz.xp}</b> Punkte</span>
        <span class="combo ${quiz.combo >= 2 ? "hot" : ""}" id="hudCombo">${quiz.combo >= 2 ? `${quiz.combo}er-Serie` : ""}</span>
      </div>
      <div class="question">
        <span class="label">${toFx ? "Deutsch" : esc(langName(list.lang))}</span>
        <div class="row" style="justify-content:center">
          <span class="word" id="askWord">${toFx ? esc(ask) : sylHTML(ask, list.lang)}</span>
          ${toFx ? "" : `<button class="speak" id="sayAsk" aria-label="Vorlesen">${SPEAKER}</button>`}
        </div>
        <span class="muted small">${quiz.mode === "choose" ? "Wähle die richtige Übersetzung" : "Schreibe die Übersetzung"}</span>
      </div>
      ${body}
      <div id="fb"></div>
    </section>
    <p class="small muted" style="text-align:center">${esc(list.name)} · ${quiz.mode === "choose" ? "Wähle ein Wort" : "Schreibe das Wort"}</p>`;

  if (!toFx) { speak(w.f, list.lang, $("#askWord")); $("#sayAsk").onclick = () => speak(w.f, list.lang, $("#askWord")); }
  if (quiz.mode === "choose") {
    app.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => {
      if (quiz.answered) return;
      const ok = +b.dataset.opt === wi;
      app.querySelectorAll("[data-opt]").forEach(x => { x.disabled = true; if (+x.dataset.opt === wi) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      answer(ok ? "right" : "wrong");
    });
  } else {
    const inp = $("#answer");
    setTimeout(() => inp.focus(), 30);
    app.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => {
      const s = inp.selectionStart ?? inp.value.length, e = inp.selectionEnd ?? s;
      inp.value = inp.value.slice(0, s) + b.dataset.acc + inp.value.slice(e);
      inp.focus(); inp.setSelectionRange(s + 1, s + 1);
    });
    $("#wform").onsubmit = ev => {
      ev.preventDefault();
      if (quiz.answered) return next();
      if (!inp.value.trim()) { inp.focus(); return; }
      const r = checkTyped(inp.value, sol);
      inp.readOnly = true;
      inp.classList.add(r === "right" ? "right" : "wrong");
      $("#check").textContent = "Weiter";
      answer(r);
    };
  }
}

function answer(result) {
  const list = getList(quiz.listId), wi = quiz.current, w = list.words[wi];
  quiz.answered = true;
  const ok = result === "right";
  let gained = 0, bonus = 0;
  if (ok) {
    // Punkte gibt es pro Runde nur einmal pro Wort, und nur wenn es beim ersten Versuch sitzt
    gained = quiz.missed.has(wi) ? 0 : quiz.mode === "write" ? 15 : 10;
    if (!quiz.missed.has(wi)) quiz.firstTry.add(wi);
    quiz.combo++; quiz.correct++;
    quiz.bestCombo = Math.max(quiz.bestCombo, quiz.combo);
    if (quiz.combo % 5 === 0) bonus = 10;
    w.ok++; quiz.queue.shift(); quiz.done++;
    sfxRight();
  } else {
    quiz.combo = 0;
    quiz.missed.add(wi); w.ko++;
    quiz.queue.shift();
    quiz.queue.splice(Math.min(3, quiz.queue.length), 0, wi);
    sfxWrong();
  }
  quiz.xp += gained + bonus;
  setTimeout(() => speak(w.f, list.lang, $("#solWord")), prefs.sound ? 260 : 0);

  const head = ok ? pick(PRAISE) : result === "almost" ? "Fast! Achte auf die Schreibweise." : pick(COMFORT);
  $("#fb").innerHTML = `<div class="feedback ${ok ? "right" : "wrong"}">
      <div class="stack" style="gap:2px;min-width:0">
        <strong>${head}</strong>
        <span class="who">${esc(w.d)} = <span class="sol" id="solWord">${sylHTML(w.f, list.lang)}</span></span>
      </div>
      <div class="row">
        ${gained ? `<span class="gain">+${gained}${bonus ? ` <em>+${bonus} Serie!</em>` : ""}</span>` : ""}
        <button class="speak big" id="sayAgain" aria-label="Nochmals vorlesen">${SPEAKER}</button>
        ${quiz.mode === "choose" ? `<button class="primary" id="nextBtn">Weiter</button>` : ""}
      </div></div>`;
  $("#hudXp").textContent = quiz.xp;
  const hc = $("#hudCombo");
  hc.textContent = quiz.combo >= 2 ? `${quiz.combo}er-Serie` : "";
  hc.classList.toggle("hot", quiz.combo >= 2);
  if (bonus) { hc.classList.remove("pop"); void hc.offsetWidth; hc.classList.add("pop"); confetti(50); }
  $("#sayAgain").onclick = () => speak(w.f, list.lang, $("#solWord"));
  $("#nextBtn")?.addEventListener("click", next);
  $("#nextBtn")?.focus();
}
function next() { renderQuiz($("#app")); }
document.addEventListener("keydown", e => {
  if (view.name === "quiz" && quiz?.answered && quiz.mode === "choose" && e.key === "Enter") { e.preventDefault(); next(); }
});

function finishQuiz() {
  const list = getList(quiz.listId);
  const s = profile.stats;
  const perfect = quiz.missed.size === 0;
  if (perfect) quiz.xp += 20;
  profile.xp += quiz.xp;
  quiz.prevBest = list.best || 0;
  list.points = (list.points || 0) + quiz.xp;
  list.best = Math.max(quiz.prevBest, quiz.xp);
  s.correct += quiz.correct; s.sessions++;
  if (quiz.mode === "write") s.writeSessions++;
  s.bestCombo = Math.max(s.bestCombo, quiz.bestCombo);
  if (perfect) s.perfect++;
  quiz.result = { perfect, record: quiz.prevBest > 0 && quiz.xp > quiz.prevBest, levelUp: levelOf(profile.xp) > quiz.startLevel, fresh: checkBadges(), stars: listStars(list) };
  if (!list.example) persistList(list);
  persistProfile();
  go({ name: "done" });
}

function renderDone(app) {
  const list = getList(quiz.listId), r = quiz.result;
  const first = quiz.firstTry.size, total = quiz.total;
  const hard = [...quiz.missed].map(i => list.words[i]);
  const pct = Math.round(first / total * 100);
  const lvl = levelOf(profile.xp);
  app.innerHTML = `
    <section class="sheet done" style="text-align:center;align-items:center">
      <span class="label">${r.levelUp ? "Level geschafft!" : r.record ? "Neuer Rekord!" : "Runde geschafft"}</span>
      <span class="score">+${quiz.xp}</span>
      <span class="muted">Punkte in dieser Runde${r.perfect ? " (inklusive 20 Bonuspunkte für eine Runde ohne Fehler)" : ""}</span>
      <div class="tally">
        <div><span class="label">Dieser Voci-Satz</span><b>${list.points}</b><span class="small muted">${r.record ? `Neuer Rekord! Vorher ${quiz.prevBest}` : `Rekord pro Runde: ${list.best}`}</span></div>
        <div><span class="label">Total alle Listen</span><b>${profile.xp}</b><span class="small muted">Level ${lvl}</span></div>
      </div>
      <p class="big-praise">${r.perfect ? "Alles beim ersten Versuch gewusst. Wahnsinn!" : pct >= 75 ? "Sehr gut! Noch ein paar Wörter üben, dann sitzt die Liste." : pct >= 40 ? "Gut gemacht! Jede Runde bringt dich weiter." : "Toll, dass du übst! Die schwierigen Wörter gleich nochmals?"}</p>
      <div class="row" style="justify-content:center;gap:18px">
        <span class="inline-stat"><b>${first}/${total}</b>&nbsp;beim ersten Versuch</span>
        <span class="inline-stat"><b>${quiz.bestCombo}</b>&nbsp;längste Serie</span>
        ${list.example ? "" : `<span class="stars big" aria-label="${r.stars} von 3 Sternen">${STAR(r.stars >= 1)}${STAR(r.stars >= 2)}${STAR(r.stars >= 3)}</span>`}
      </div>
      <div class="stack" style="gap:4px;width:100%;max-width:360px">
        <div class="row between small"><strong>Level ${lvl} · ${esc(levelName(lvl))}</strong><span class="muted">${profile.xp} / ${xpNeed(lvl + 1)}</span></div>
        <div class="bar xp"><i id="xpFill" style="width:0%"></i></div>
      </div>
    </section>
    ${hard.length ? `<section class="sheet">
      <h3>Diese Wörter üben wir nochmals</h3>
      <div class="hard">${hard.map((w, k) => `<div><span>${esc(w.d)}</span><span class="row" style="gap:6px"><strong id="hw${k}">${sylHTML(w.f, list.lang)}</strong><button class="speak" data-say="${k}" aria-label="Vorlesen">${SPEAKER}</button></span></div>`).join("")}</div>
    </section>` : ""}
    <div class="row" style="justify-content:center">
      ${hard.length ? `<button class="primary" id="againHard">Schwierige nochmals</button>` : ""}
      <button ${hard.length ? "" : 'class="primary"'} id="againAll">Ganze Liste nochmals</button>
      ${list.example ? "" : `<button class="ghost" id="editList">Liste bearbeiten</button>`}
      <button class="ghost" id="home">Zu den Listen</button>
    </div>`;
  requestAnimationFrame(() => setTimeout(() => { const f = $("#xpFill"); if (f) f.style.width = levelPct(profile.xp) + "%"; }, 60));
  if (!quiz.celebrated) {
    quiz.celebrated = true;
    if (r.perfect || r.levelUp || r.record || pct >= 75) { sfxFanfare(); confetti(r.perfect || r.levelUp ? 180 : 100); }
    if (r.levelUp) setTimeout(() => toast(`<div><strong>Level ${lvl}!</strong><br><span>Du bist jetzt ${esc(levelName(lvl))}.</span></div>`, "level"), 400);
    setTimeout(() => celebrateBadges(r.fresh), r.levelUp ? 1300 : 500);
  }
  app.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(hard[+b.dataset.say].f, list.lang, $("#hw" + b.dataset.say)));
  $("#editList")?.addEventListener("click", () => go({ name: "edit", list: JSON.parse(JSON.stringify(list)), isNew: false }));
  $("#againHard")?.addEventListener("click", () => { quiz = newQuiz(list.id, [...quiz.missed]); go({ name: "quiz" }); });
  $("#againAll").onclick = () => startQuiz(list.id, false);
  $("#home").onclick = () => go({ name: "home" });
}

/* ---------- Start ---------- */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
(async () => {
  if (!sb) { go({ name: "login" }); return; }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { if (session) { user = userFrom(session.user); startSession(user); } go({ name: "recover" }); return; }
    if (event === "SIGNED_IN" && session && (!user || user.id !== session.user.id)) startSession(userFrom(session.user));
    if (event === "SIGNED_OUT") { user = null; go({ name: "login" }); }
  });
  const { data } = await sb.auth.getSession();
  if (data.session) { if (!user) startSession(userFrom(data.session.user)); }
  else if (view.name === "loading") go({ name: "login" });
})();
