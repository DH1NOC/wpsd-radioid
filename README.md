# WPSD RadioID Namen

Chrome-Erweiterung für das [WPSD](https://wpsd.radio)-Dashboard: Sie ergänzt die Tabellen um **Name** und **Wohnort** zum Rufzeichen (Daten von [radioid.net](https://radioid.net)) und zeigt das **QRZ-Profilfoto** des aktuellen Anrufers.

*English summary: Chrome extension that adds the operator's name and city (from radioid.net) to the call sign tables of the WPSD dashboard and shows the caller's QRZ.com profile photo.*

## Funktionen

- **Name und Ort** in jeder Tabelle mit einer Spalte „Callsign“ (z. B. *Gateway Activity*, *Local RF Activity*). Fährt man mit der Maus über Name oder Ort, werden Ort und Land angezeigt.
- **Profilfoto von QRZ.com** im Bereich *Current / Last Caller Details* und groß auf der Seite *Live Caller*. Ein Klick aufs Foto öffnet das QRZ-Profil. Ein QRZ-Login ist nicht nötig.
- **Zwischenspeicher:** Namen und Orte werden 30 Tage, Fotos 7 Tage lokal gespeichert, damit radioid.net und QRZ.com nicht bei jedem Refresh erneut abgefragt werden.
- **Robust bei Störungen:** Ist radioid.net kurz nicht erreichbar, steht ein „?“ in der Namensspalte und die Abfrage wird automatisch wiederholt (nach 30 s, 1 min, 2 min … höchstens alle 10 min) – ohne Neuladen der Seite.
- **Nur auf freigeschalteten Dashboards:** Die Erweiterung läuft ausschließlich auf Adressen, die man selbst freigibt, und erkennt WPSD-Seiten am Inhalt.
- **Eingebauter Bug-Reporter** im Popup (siehe unten).

## Installation

1. Unter [Releases](../../releases/latest) die Datei `wpsd-radioid-<version>.zip` herunterladen und entpacken.
2. In Chrome `chrome://extensions` öffnen und oben rechts den **Entwicklermodus** einschalten.
3. **„Entpackte Erweiterung laden“** klicken und den entpackten Ordner `wpsd-radioid-<version>` wählen.
4. Das Erweiterungs-Symbol anheften (Puzzle-Symbol in der Symbolleiste → Pin).

Den Ordner danach nicht löschen oder verschieben – Chrome lädt die Erweiterung bei jedem Start von dort.

Funktioniert auch in anderen Chromium-Browsern (Edge, Brave, Vivaldi …).

## Für ein Dashboard freischalten

1. WPSD-Dashboard öffnen (z. B. `http://wpsd.local/` oder `http://pi-star/`).
2. Auf das Erweiterungs-Symbol klicken. Wird die Seite als WPSD erkannt, erscheint **„Für diese Adresse aktivieren“**.
3. Chrome fragt einmalig nach Zugriff auf genau diese Adresse – bestätigen.

Das ist pro Dashboard-Adresse nur einmal nötig, danach läuft die Erweiterung dort automatisch, auch nach einem Neustart von Chrome. Abschalten: Symbol anklicken → **„Für diese Adresse deaktivieren“**.

> **Hinweis:** Die Freigabe gilt für den Hostnamen, so wie er in der Adresszeile steht. Wer das Dashboard mal über den Namen und mal über die IP-Adresse aufruft, muss beide freischalten.

## Aktualisieren

1. Neues ZIP aus den [Releases](../../releases/latest) herunterladen und entpacken.
2. Inhalt in den bisherigen Ordner kopieren (alte Dateien ersetzen).
3. In `chrome://extensions` bei „WPSD RadioID Namen“ auf den **Neu-laden-Pfeil** klicken.

Freischaltungen und Zwischenspeicher bleiben dabei erhalten.

## Fehler melden

Im Popup unten auf **„🐞 Fehler melden …“** klicken:

1. Die Erweiterung erfasst den aktuellen Zustand von Seite und Erweiterung sowie einen Screenshot des sichtbaren Bereichs. Unter „Erfasste Daten anzeigen“ lässt sich alles vorher einsehen.
2. Kurz beschreiben, was schiefgelaufen ist.
3. **„E-Mail erstellen“** öffnet das Mailprogramm mit einer fertigen Nachricht an den Entwickler.
4. Im Mailtext **⌘V** (Mac) bzw. **Strg+V** (Windows) drücken – Bericht, Screenshot und HTML-Code der Seite werden eingefügt. Dann senden.

Alternativ gerne ein [Issue](../../issues) auf GitHub anlegen.

## Datenschutz

- Abgefragt werden nur die Rufzeichen, die im Dashboard angezeigt werden – bei `radioid.net` (Name, Ort, Land) und auf der öffentlichen Profilseite von `qrz.com` (Foto).
- Die Ergebnisse werden ausschließlich lokal im Browser gespeichert.
- Die Erweiterung sendet keine Daten an den Entwickler oder an Dritte. Ein Bug-Report wird nur verschickt, wenn man ihn selbst im eigenen Mailprogramm absendet.

## Berechtigungen

| Berechtigung | Wofür |
|---|---|
| `storage` | Zwischenspeicher für Namen, Orte und Fotos |
| `scripting` | Einfügen der Anzeige in freigeschaltete Dashboards |
| `activeTab` | WPSD-Erkennung und Screenshot für den Bug-Reporter, nur nach Klick auf das Symbol |
| `https://radioid.net/*` | Abfrage von Name und Ort |
| `https://www.qrz.com/*` | Abfrage des Profilfotos |
| Optional: einzelne Dashboard-Adressen | Nur die Adressen, die man selbst freischaltet |

## Aufbau

| Datei | Inhalt |
|---|---|
| `manifest.json` | Manifest (Chrome Manifest V3) |
| `background.js` | Abfragen bei radioid.net und QRZ.com, Zwischenspeicher, Freischaltung pro Adresse |
| `detect.js` | Erkennt WPSD-Seiten am Inhalt |
| `content.js` / `content.css` | Fügt Spalten und Fotos ins Dashboard ein |
| `popup.html` / `popup.js` | Popup am Erweiterungs-Symbol |
| `bugreport.js` | Bug-Reporter im Popup |
| `build.sh` | Baut das Release-ZIP |

Release bauen: `./build.sh` erzeugt `dist/wpsd-radioid-<version>.zip` (Version aus `manifest.json`).

## Hinweise

- radioid.net liefert inzwischen keinen Nachnamen mehr aus, daher wird nur der Vorname angezeigt.
- Diese Erweiterung ist ein privates Projekt und steht in keiner Verbindung zu WPSD, radioid.net oder QRZ.com.

## Lizenz

[MIT](LICENSE) – 73 de DH1NOC
