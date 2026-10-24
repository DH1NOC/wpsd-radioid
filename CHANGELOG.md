# Changelog

## 2.1.1 – 2026-10-24

- Fehlgeschlagene Abfragen bei radioid.net werden automatisch wiederholt (30 s, 1 min, 2 min … max. 10 min). Bisher blieben Name und Ort nach einer kurzen Störung leer, bis die Seite neu geladen wurde.
- Während einer Störung zeigt die Namensspalte „?“ mit Hinweis statt einer leeren Zelle.

## 2.1.0 – 2026-10-24

- Neuer Bug-Reporter im Popup: erfasst Zustand von Seite und Erweiterung samt Screenshot und erstellt eine E-Mail mit sprechendem Betreff. Bericht, Screenshot und Seiten-HTML werden per Einfügen direkt in die Mail übernommen.
- Fehler bei Abfragen von radioid.net und QRZ.com werden protokolliert (letzte 20) und fließen in den Bug-Report ein.

## 2.0.0

- Freischaltung pro Dashboard-Adresse über das Popup statt Zugriff auf alle Seiten.
- WPSD-Erkennung am Seiteninhalt.
- QRZ-Profilfoto in *Current / Last Caller Details* und auf der Seite *Live Caller*.
- Spalte „Ort“ zusätzlich zum Namen.
