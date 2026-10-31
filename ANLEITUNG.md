# Voci-Heft einrichten

Das Voci-Heft ist eine Web-App. Sie läuft im Browser und lässt sich auf Handy und Tablet wie eine normale App installieren. Damit sich jedes Kind mit einem eigenen Konto einloggen kann, braucht es eine kleine Datenbank bei **Supabase**. Für eine Familie oder eine Schulklasse ist das gratis.

Die Einrichtung dauert etwa 20 Minuten.

---

## 1. Supabase-Projekt erstellen

1. Gehe auf <https://supabase.com> und erstelle ein kostenloses Konto.
2. Klicke auf **New project**.
   - Name: zum Beispiel `voci-heft`
   - Datenbank-Passwort: Wähle ein sicheres Passwort und bewahre es gut auf.
   - Region: **Central EU (Zurich)**, falls verfügbar, sonst **Central EU (Frankfurt)**
3. Warte etwa eine Minute, bis das Projekt bereit ist.

## 2. Tabellen anlegen

1. Öffne im Projekt links den **SQL Editor**.
2. Kopiere den ganzen Inhalt der Datei `datenbank.sql` hinein.
3. Klicke auf **Run**. Die Meldung „Success“ erscheint.

Damit gibt es zwei Tabellen, eine für die Listen und eine für Punkte und Abzeichen. Die Regeln darin sorgen dafür, dass jedes Konto **nur seine eigenen Daten** sehen und ändern kann.

## 3. Anmeldung einstellen

Unter **Authentication**:

- **Sign In / Providers → Email**: Ist „Confirm email“ eingeschaltet, muss jedes neue Konto zuerst einen Link in einer E-Mail anklicken. Für jüngere Kinder kannst du das ausschalten, dann geht die Anmeldung sofort.
- **URL Configuration → Site URL**: Trage hier später die Adresse deiner App ein (siehe Schritt 5), zum Beispiel `https://voci-heft.netlify.app`. Diese Adresse brauchen die Links in den E-Mails, etwa zum Zurücksetzen des Passworts.

**Tipp für Kinder ohne eigene E-Mail-Adresse:** Viele Mail-Dienste (Proton, Gmail, Outlook) leiten Adressen mit einem Pluszeichen weiter. `eltern+mia@proton.me` und `eltern+leo@proton.me` landen beide im Postfach der Eltern, gelten aber als zwei getrennte Konten.

## 4. App mit Supabase verbinden

1. Öffne in Supabase **Project Settings → API** (oder **Data API**).
2. Kopiere die **Project URL** und den **anon public**-Schlüssel (manchmal heisst er „publishable key“).
3. Öffne die Datei `config.js` und trage beides ein:

```js
window.VOCI_CONFIG = {
  supabaseUrl: "https://abcdefghijkl.supabase.co",
  supabaseAnonKey: "eyJhbGciOi..."
};
```

Dieser Schlüssel darf öffentlich sein. Den **service_role**-Schlüssel darfst du dagegen nie in die App schreiben.

## 5. App ins Internet stellen

Die App liegt auf GitHub unter <https://github.com/ooeler/voci-heft>. **GitHub Pages** veröffentlicht sie automatisch unter:

**<https://ooeler.github.io/voci-heft/>**

Jede Änderung, die auf den Zweig `main` kommt, ist nach etwa einer Minute online. Den Stand siehst du im Repository unter **Actions**.

1. Ändere `config.js` direkt auf GitHub: Öffne die Datei, klicke auf den Stift (Bearbeiten), trage URL und Schlüssel ein und klicke auf **Commit changes**.
2. Trage `https://ooeler.github.io/voci-heft/` in Supabase als **Site URL** ein (Schritt 3).

Weil das Repository öffentlich ist, kann jede Person den Code und den Inhalt von `config.js` sehen. Der „anon public“-Schlüssel ist dafür gedacht und darf dort stehen. Den **service_role**-Schlüssel, das Datenbank-Passwort und einen Claude-Schlüssel darfst du nie ins Repository schreiben.

## 6. Auf dem Handy oder Tablet installieren

- **Android (Chrome):** Öffne die Adresse und tippe in der App auf „App installieren“ oder im Menü auf „Zum Startbildschirm hinzufügen“.
- **iPhone/iPad (Safari):** Öffne die Adresse, tippe auf **Teilen** und dann auf **Zum Home-Bildschirm**.

Danach startet das Voci-Heft wie eine normale App. Bereits geladene Listen lassen sich auch ohne Internet lernen. Sobald wieder eine Verbindung besteht, werden die Punkte synchronisiert.

## 7. Optional: Bessere Foto-Erkennung mit Claude

Für gedruckte Voci-Listen (Lehrmittel, Arbeitsblätter) brauchst du das nicht. Die App liest sie direkt auf dem Gerät, gratis und ohne dass Fotos das Gerät verlassen. Sie erkennt zwei Spalten (Fremdsprache und Deutsch) und überspringt eine Spalte mit Lautschrift wie `[ˈkɪtʃɪn]`. Beim ersten Scan lädt sie die Texterkennung herunter (etwa 10 MB), danach geht es schnell.

Nur wenn die Erkennung bei euren Blättern oft danebenliegt, lohnt sich Claude:

1. Erstelle auf <https://console.anthropic.com> ein Konto, lade etwas Guthaben auf (zum Beispiel 5 Dollar) und erstelle einen **API Key**.
2. Trage den Schlüssel in der App unter **Einstellungen → Fotos auslesen** ein.

Ein Scan kostet etwa 2 bis 5 Rappen. Der Schlüssel wird nur auf diesem Gerät gespeichert. Gib ihn nur auf Geräten ein, denen du vertraust, denn wer das Gerät benutzt, kann damit scannen.

---

## Wörter nach dem Scan korrigieren

Nach dem Scan springt die App zur Wortliste. Die neu erkannten Wörter sind gelb markiert. Tippe in ein Feld, um ein Wort zu korrigieren, lösche falsche Zeilen mit ✕ oder ergänze fehlende mit „+ Wort hinzufügen“. Erst „Liste speichern“ übernimmt alles. Später kannst du jede Liste über „Bearbeiten“ wieder ändern, auch direkt nach einer Lernrunde.

## Silben beim Vorlesen

Wenn die App ein Fremdwort vorliest, zeigt sie es in Silben getrennt an, zum Beispiel „la fe·nê·tre“ oder „de·li·cious“. Die gerade gesprochene Silbe leuchtet gelb auf. Die Silben werden automatisch bestimmt. Bei unregelmässigen Wörtern, besonders im Englischen, stimmt die Trennung nicht immer genau.

## Wie funktioniert die Motivation?

| Was | Wie viel |
|---|---|
| Richtig beim ersten Versuch, Modus „Wähle ein Wort“ | 10 Punkte |
| Richtig beim ersten Versuch, Modus „Schreibe das Wort“ | 15 Punkte |
| Richtig nach einem Fehler (das Wort kam in dieser Runde schon) | 0 Punkte |
| Alle 5 richtig hintereinander | 10 Bonuspunkte |
| Ganze Runde ohne Fehler | 20 Bonuspunkte |

- **Pro Runde zählt jedes Wort nur einmal.** Wer ein Wort falsch hat, übt es in der gleichen Runde nochmals, bekommt dafür aber keine Punkte mehr.
- **Levels:** Level 2 gibt es ab 100 Punkten, Level 3 ab 300, Level 4 ab 600 und so weiter. Jedes Level hat einen eigenen Namen, vom „Wörtli-Entdecker“ bis zur „Sprach-Legende“.
- **Sterne pro Liste:** 1 Stern, wenn ein Drittel der Wörter sitzt, 2 Sterne bei zwei Dritteln, 3 Sterne, wenn alle Wörter sitzen.
- **Abzeichen:** 11 Auszeichnungen, zum Beispiel „Fehlerlos“ oder „Zehnerkette“.

## Eine neue Version hochladen

Lade die Änderung auf GitHub hoch. GitHub Actions baut die App und veröffentlicht sie automatisch (Workflow „Veröffentlichen“). Die Geräte laden die neue Version beim nächsten Öffnen.

Zum Ausprobieren auf dem eigenen Computer: `npm ci` und danach `npm run build`. Die fertige App liegt dann im Ordner `dist`.

## Wartungsseite

**Bei jedem Update:** Sobald eine neue Version online ist, merkt die App das. Das passiert beim Öffnen, beim Zurückwechseln in die App und sonst alle 30 Minuten. Die App zeigt dann kurz „Update wird eingespielt“ und lädt sich neu. Läuft gerade eine Lernrunde oder wird eine Liste bearbeitet, wartet die App damit, bis das Kind fertig ist. So geht nichts verloren.

**Wartung von Hand**, zum Beispiel wenn du die Datenbank änderst:

1. Öffne auf GitHub die Datei `wartung.json` und klicke auf den Stift.
2. Setze `"aktiv": true`. Bei `"nachricht"` kannst du einen eigenen Text eintragen.
3. Klicke auf **Commit changes**. Nach etwa einer Minute zeigen alle offenen Apps die Wartungsseite.
4. Wenn du fertig bist, setze wieder `"aktiv": false`. Innerhalb einer Minute geht es in der App weiter, auch mitten in einer Lernrunde.

## Automatische Updates

Die Bibliotheken (Supabase, Texterkennung, Silben, Claude) kommen nicht von fremden Servern, sondern werden beim Bauen in die App gepackt.

- **Dependabot** prüft jede Woche, ob es neue Versionen gibt, und öffnet dafür einen Pull Request. Sicherheitslücken meldet es sofort.
- Der Workflow **„PR prüfen“** baut die App mit der neuen Version. Klappt das, übernimmt er das Update und veröffentlicht die App.
- **Grosse Versionssprünge** (zum Beispiel von 2.x auf 3.x) laufen genauso automatisch durch. Sie können die App verändern, darum fängt nur der Build grobe Fehler ab, solange der Black-Box-Test keinen Schlüssel hat.

## Automatischer Test bei jedem Pull Request

Bei jedem Pull Request prüft der Tester `voci-tester` die App wie ein kritischer Benutzer. Er bedient sie im Browser und kennt nur die Use Cases in `qa/use-cases.md`. Den Bericht schreibt er als Kommentar in den Pull Request.

- **Kein Zugriff auf den Code:** Der Job holt den Code nicht, der Tester hat nur Browser-Werkzeuge, und der Testserver sperrt das direkte Öffnen von Dateien.
- **Keine echten Daten:** Der Test läuft ohne die echte `config.js`. Er erreicht deine Supabase-Datenbank nicht und legt keine Konten an.
- **Blocker halten auf:** Ein Befund der Stufe `blocker` lässt den Check scheitern, und Dependabot-Updates werden dann nicht übernommen. Andere Befunde stehen nur im Kommentar.
- **Kosten:** Der Test braucht einen eigenen Claude-API-Schlüssel und kostet pro Durchgang höchstens 3 Dollar. Die Grenze steht in `qa/test.sh` (`TESTER_BUDGET_USD`).

Der Schlüssel muss zweimal hinterlegt sein: einmal für normale Pull Requests und einmal für Dependabot.

```bash
gh secret set ANTHROPIC_API_KEY --repo ooeler/voci-heft
```

```bash
gh secret set ANTHROPIC_API_KEY --repo ooeler/voci-heft --app dependabot
```

Ohne Schlüssel wird der Test mit einer Warnung übersprungen, und Updates werden wie bisher nach dem Build übernommen. Pull Requests aus fremden Forks werden aus Sicherheitsgründen nicht getestet.

Wenn du neue Funktionen baust, ergänze sie in `qa/use-cases.md`. Der Tester prüft nur, was er kennt oder selbst entdeckt.

## Sicherheit

Die App selbst ist abgesichert:

- Alle Wörter, Namen und Sicherungsdateien werden geprüft und vor der Anzeige unschädlich gemacht.
- Eine Content Security Policy erlaubt nur Programmcode von der eigenen Seite.
- Die Datenbank lässt jedes Konto nur an seine eigenen Daten und begrenzt deren Grösse.
- GitHub prüft den Code mit CodeQL und sucht nach versehentlich hochgeladenen Schlüsseln.

Stelle in Supabase zusätzlich Folgendes ein:

1. **Authentication → Sign In / Providers → Email:** „Confirm email“ eingeschaltet lassen. Weil die App öffentlich ist, kann sich sonst jede Person mit einer erfundenen Adresse ein Konto machen.
2. **Authentication → Sign In / Providers → Email:** Bei **Minimum password length** mindestens `8` eintragen. Falls verfügbar, auch **Leaked password protection** einschalten.
3. Wenn nur eure Familie die App benutzen soll: Erstelle die Konten selbst unter **Authentication → Users → Add user** und schalte danach unter **Sign In / Providers** die Option **Allow new users to sign up** aus.
4. Führe `datenbank.sql` nach jedem Update dieser Datei nochmals aus.
