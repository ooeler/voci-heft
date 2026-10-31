# Use Cases: Voci-Heft

Das Voci-Heft ist eine Lern-App für Schulkinder. Sie scannen gedruckte Voci-Listen mit dem Handy und lernen die Wörter. Die Sprache der App ist Schweizer Hochdeutsch (kein ß).

Diese Datei beschreibt, was die App aus Sicht der Benutzer können muss. Alles andere ist Sache des Testers: Wenn etwas verwirrt, kaputt aussieht oder einem Kind nicht klar wäre, ist das ein Befund, auch wenn es hier nicht steht.

## A. Einstieg

- **A1 Ohne Konto ausprobieren:** Auf der Anmeldeseite führt „Ohne Konto ausprobieren“ direkt in die App. Es erscheint eine Beispiel-Liste.
- **A2 Anmeldeformular:** Es gibt die Reiter „Anmelden“ und „Konto erstellen“. Leere oder ungültige Eingaben werden abgefangen. Ein Passwort braucht mindestens 8 Zeichen.
- **A3 Keine Verbindung zum Server:** In dieser Testumgebung gibt es keinen Server für Konten. Anmelden, Registrieren und „Passwort vergessen?“ müssen deshalb scheitern, aber mit einer verständlichen Meldung. Die App darf dabei nicht hängen bleiben, und der Knopf muss wieder benutzbar werden.
- **A4 App installieren:** Auf der Anmeldeseite und in den Einstellungen steht, wie man die App auf den Startbildschirm legt.

## B. Lernen

- **B1 Modus „Wähle ein Wort“:** Die App zeigt ein Wort und mehrere Antworten. Richtig und falsch werden sofort angezeigt.
- **B2 Modus „Schreibe das Wort“:** Das Kind tippt die Antwort ein. Bei Fremdsprachen gibt es Knöpfe für Sonderzeichen, wo sie nötig sind.
- **B3 Richtung:** „Deutsch → Fremdsprache“ und „Fremdsprache → Deutsch“ funktionieren beide. Die Einstellung wirkt auf die nächste Runde.
- **B4 Falsche Wörter kommen wieder:** Ein falsch beantwortetes Wort kommt in derselben Runde nochmals. Die Runde endet erst, wenn alle Wörter einmal richtig waren.
- **B5 Vorlesen und Silben:** Das richtige Fremdwort wird nach der Antwort vorgelesen und in Silben getrennt angezeigt, zum Beispiel „de·li·cious“ oder „la fe·nê·tre“. In der Testumgebung gibt es vermutlich keinen Ton. Prüfe die Anzeige, nicht den Ton.
- **B6 Rundenende:** Am Ende stehen das Resultat, die Punkte dieses Voci-Satzes, der Total und die schwierigen Wörter. Es gibt Knöpfe zum Weiterlernen, zum Bearbeiten der Liste und zurück zur Übersicht.
- **B7 Nur schwierige:** Gibt es Wörter mit mehr Fehlern als Treffern, erscheint auf der Liste „Nur schwierige“. Diese Runde enthält nur diese Wörter.

## C. Punkte und Motivation

- **C1 Punkte:** Richtig beim ersten Versuch gibt 10 Punkte beim Wählen und 15 beim Schreiben. Richtig nach einem Fehler gibt 0 Punkte, weil jedes Wort pro Runde nur einmal zählt.
- **C2 Bonus:** Alle 5 richtigen Antworten hintereinander geben 10 Bonuspunkte. Eine ganze Runde ohne Fehler gibt 20 Bonuspunkte.
- **C3 Punktestand:** Die Punkte stehen pro Voci-Satz, als Rekord pro Runde und als Total. Der Total steigt nach einer Runde genau um die Punkte dieser Runde.
- **C4 Level, Sterne, Abzeichen:** Level 2 beginnt bei 100 Punkten, Level 3 bei 300. Eine Liste hat 1 Stern, wenn ein Drittel der Wörter sitzt, 2 Sterne bei zwei Dritteln, 3 bei allen. Neue Abzeichen werden gemeldet und in der Übersicht markiert. Es gibt Abzeichen für 10, 20, 50 und 100 Lernrunden und für Listen, die 5 Mal ganz gelernt wurden. Alle 5 ganzen Durchgänge einer Liste gibt es am Rundenende ein Lob.

## D. Listen

- **D1 Liste scannen:** Mit „Neue Liste scannen“ lädt man ein Foto hoch und lässt es lesen. Die erkannten Wörter erscheinen danach als Zeilen. Die Testbilder liegen unter `fixtures/` (siehe unten).
- **D2 Nach dem Scan korrigieren:** Neu erkannte Zeilen sind gelb markiert und lassen sich direkt ändern, löschen und ergänzen. Erst „Liste speichern“ übernimmt alles.
- **D3 Schlechtes Foto:** Bei einem Foto ohne Text sagt die App verständlich, dass nichts erkannt wurde, und bleibt benutzbar.
- **D4 Liste von Hand:** Eine Liste lässt sich ohne Foto anlegen: Name, Sprache, Wörter mit „+ Wort hinzufügen“, Spalten tauschen.
- **D5 Bearbeiten und Löschen:** Bestehende Listen lassen sich ändern und, nach einer Rückfrage, löschen. Das Beispiel lässt sich nicht bearbeiten.
- **D6 Speicherort:** Ohne Konto bleiben Listen und Punkte nach einem Neuladen auf dem Gerät erhalten.
- **D7 Sonderzeichen:** Wörter mit Apostroph, Umlaut, Akzent oder spitzen Klammern (`<b>test</b>`) erscheinen genau so, wie man sie eingetippt hat, und verändern die Darstellung nicht.

## E. Einstellungen

- **E1 Vorlesen und Klänge:** Tempo, Stimme und Klänge lassen sich einstellen und bleiben erhalten. Pro Sprache der eigenen Listen gibt es eine Stimmenwahl. Fehlt auf dem Gerät eine Stimme, sagt die App das. In der Testumgebung gibt es vermutlich keine Stimmen.
- **E2 Claude-Schlüssel:** Ein Schlüssel, der nicht mit `sk-ant-` beginnt, wird mit einer Meldung abgelehnt. Gib nie einen echten Schlüssel ein.
- **E3 Sicherung:** „Sicherung laden“ lehnt eine Datei ab, die keine Voci-Heft-Sicherung ist, und zeigt eine Meldung.

## F. Darstellung

- **F1 Handy:** Bei 375 × 812 Pixeln ist alles lesbar und bedienbar. Es gibt kein seitliches Scrollen, nichts ist abgeschnitten.
- **F2 Computer:** Bei 1280 × 800 Pixeln sieht die App ordentlich aus.
- **F3 Fehlerfreiheit:** Die Browser-Konsole zeigt beim normalen Gebrauch keine Fehler. Ausgenommen sind die erwarteten Fehler der Konto-Anfragen aus A3.

## Testbilder

- `fixtures/englisch-liste.png`: Gedruckte Liste mit 8 Wortpaaren (Englisch und Deutsch).
- `fixtures/franzoesisch-liste.png`: Gedruckte Liste mit 6 Wortpaaren (Französisch und Deutsch).
- `fixtures/leeres-blatt.png`: Leeres weisses Blatt.
- `fixtures/keine-sicherung.json`: Datei, die keine Voci-Heft-Sicherung ist.

## In dieser Umgebung nicht testbar

Echtes Anmelden und Synchronisieren, Installation auf einem Gerät, Ton und Stimme, Kamera, Scannen mit Claude, Wartungsseite.
