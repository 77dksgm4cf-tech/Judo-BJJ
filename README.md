# Judo Fortschritts-Tracker (Online)

Web-App zum Abhaken der Prüfungsinhalte für Judo-Kyu-Grade (8.–1. Kyu nach den
Anforderungen des Deutschen Judo-Bundes, Stand 1. Februar 2024), zur
Graduierungsplanung und für die Anwesenheit. Läuft komplett im Browser — es
gibt **keinen Server und keine Datenbank**. Über GitHub Pages ist die App von
überall erreichbar. Eigenständiges Projekt, unabhängig von anderen Tracker-Apps.

## Wo liegen die Daten?

**Alle eingegebenen Daten (Mitglieder, Prüfungsfortschritt, Anwesenheit)
werden ausschließlich im `localStorage` des jeweiligen Browsers/Geräts
gespeichert.** Es gibt keinen Abgleich zwischen Geräten — dafür den
JSON-Export/-Import (Mehr → Daten/Archiv) nutzen. Wird der Browser-Speicher
gelöscht oder (iOS Safari) die Seite länger nicht geöffnet, können Daten
verloren gehen. Deshalb regelmäßig ein Archiv exportieren!

## Bedienung

- **Disziplin (Alle | Judo | BJJ):** Umschalter oben, wirkt auf Mitglieder,
  Graduierung, Übersicht und Anwesenheit. Jedes Mitglied hat eine Disziplin
  (Standard Judo). BJJ hat eine eigene Gürtelreihe (Weiß, Blau, Lila, Braun,
  Schwarz), aber **keinen Prüfungskatalog** — Prüfungsinhalte, Graduierung und
  Übersicht gelten nur für Judo.
- **Mitglieder:** suchen/antippen, Disziplin, Gürtel, Status, Wettkämpfer- und
  Probetraining-Flag pflegen, Prüfungsinhalte für die nächste Graduierung abhaken.
  Beim Setzen eines Kyu-Grads werden alle Inhalte bis dahin automatisch abgehakt.
- **Graduierung:** Ziel-Kyu wählen; alle Mitglieder, die darauf hinarbeiten,
  erscheinen als aufklappbare Karten mit Fortschritt.
- **Anwesenheit:** Trainingstermine anlegen/löschen (Vorschlag Di/Do unter
  Berücksichtigung bayerischer Feiertage), Anwesenheit abhaken, Monatsübersicht.
- **Mehr → Übersicht:** Matrix Mitglieder × Prüfungsinhalte.
- **Mehr → Trainingsplan:** Wochenplan je Kyu — **eigener Vorschlag**, aus den
  Prüfungsinhalten abgeleitet, keine DJB-Vorgabe (Spiele sind Beispiele).
- **Mehr → Daten/Archiv:** JSON-Sicherung und Excel-Mitgliederliste. Spalten
  (per Überschrift erkannt, Reihenfolge egal): Nr., Vorname, Nachname,
  Geburtsdatum, Alter, Austrittsdatum, Status, **Disziplin** (Judo/BJJ, leer =
  Judo), Gürtel, Wettkämpfer. Gürtel Judo: „Gelb“, „7. Kyu“ oder „7. Kyu – Gelb“.

Vereinsspezifisch anpassbar in `public/store.js`: `TRAINING_WEEKDAYS`
(Trainingstage) und `getBayernHolidays` (Feiertage).

## Prüfungsinhalte und Quelle

Die Inhalte (`scripts/kyu-data.js`) stammen aus den DJB-Unterlagen
„Anforderungen für Kyu-Grade 2024“, den Plakaten (Grund-/Erweiterungsprogramm
Stand und Boden) und der Nomenklatur-Standardisierung. Nicht enthalten:
Mindestalter, Vorbereitungszeiten, Dan-Grade — diese stehen nicht in den
verwendeten Unterlagen. Der 8. Kyu (weiß-gelb) bescheinigt laut DJB nur ein
Grundverständnis und enthält daher fünf „Grunderfahrungen“.

### Hinweise zur Quelle (Widersprüche, konservativ umgesetzt)

- 4. Kyu, Eindrehtechniken zur Gegenseite: Text sagt drei, Plakat zwei → Textfassung (drei).
- Koshi-guruma gehört zum Pool, fehlt aber in der Technikliste des 4. Kyu im Text → als Beispiel genannt.
- Hebel-/Würgetechniken: Plakate nennen weitere Beispiele (Ashi-/Hara-gatame, Hadaka-/Kataha-/Sankaku-/Tsukkomi-jime), der Text legt nur die Pflichttechniken fest → als Beispiele im Hinweistext.
- Ko-soto-gari und Ko-soto-gake sind austauschbar bzw. als Mischform zulässig.
- Konter, Finten, Kombinationen und Musterlösungen verweist das DJB-Dokument auf die Rahmentrainingskonzeption; sie sind hier nur als Anzahl geführt.
- Selbstverteidigung im 1. Kyu ist laut DJB „noch in Erarbeitung“.
- Genannte Techniken dürfen laut DJB durch ähnliche/verwandte ersetzt werden; Nomenklaturfehler bleiben unberücksichtigt.

Die Prüfungsordnung-PDFs sind urheberrechtlich geschütztes DJB-Material und
nicht Teil des Repositorys.

## Inhalte neu erzeugen

Inhalte in `scripts/kyu-data.js` ändern, dann (Node.js genügt, keine Pakete):

```
npm run generate-static-data
```

Das schreibt `public/data/techniques.js` und `public/data/trainingsplan.js`
(als Skripte statt JSON, damit die App ohne Server per Doppelklick läuft).
Technik-IDs (`k<Kyu>_<Kategorie>_<Name>`) sind stabil, solange Name/Kategorie
gleich bleiben — Umbenennungen setzen den gespeicherten Fortschritt zurück.
`node scripts/make-icons.js` erzeugt die App-Icons neu.

## Lokal testen

Kein Build und kein Server nötig: `public/index.html` per Doppelklick öffnen.
Alternativ mit lokalem Server: `npx serve public` oder
`cd public && python -m http.server 8080` und `http://localhost:8080` öffnen.

Hinweis: Der Browser-Speicher (localStorage) ist je Aufrufart getrennt – Daten,
die über `file://` erfasst wurden, erscheinen nicht unter `http://localhost:8080`
(und umgekehrt). Über JSON-Archiv (Mehr → Daten/Archiv) lassen sie sich
übertragen. Excel-Import/-Export braucht Internet (SheetJS-CDN).

## Auf GitHub Pages veröffentlichen

1. Repo `Judo-BJJ` auf GitHub anlegen (für kostenloses Pages öffentlich, siehe Datenschutz).
2. Pushen; unter Settings → Pages als Quelle **„GitHub Actions“** wählen.
   `.github/workflows/pages.yml` deployt bei jedem Push auf `main` den Ordner `public/`.
3. URL: `https://<username>.github.io/Judo-BJJ/`.

## Datenschutz

Das Repo enthält **keine Mitgliederdaten**, nur Prüfungskatalog und Trainingsplan.
Mitgliederlisten (Excel/JSON) nie ins Repo hochladen (`*.xlsx` ist in `.gitignore`).
Excel-Import/Export läuft über [SheetJS](https://sheetjs.com) im Browser (CDN).
