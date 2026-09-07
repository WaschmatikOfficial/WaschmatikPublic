# WASCHMATIK – Schritt 1 bereinigt

Diese Version basiert auf der gelieferten Full-Stack-Version.

## Was in Schritt 1 geändert wurde
- Die große `src/main.tsx` wurde in Komponenten und Seiten aufgeteilt.
- Gemeinsame Typen liegen in `src/types.ts`.
- Supabase-/Hilfsfunktionen sind sauber in `src/lib.ts` gebündelt.
- Der App-Einstieg ist auf `src/main.tsx` reduziert.
- Die Hash-Navigation wurde zentral in `src/App.tsx` gebündelt.
- Der Admin-Freigabe-Link bleibt auf der öffentlichen Domain erreichbar; normale Admin-Routen werden weiterhin auf die öffentliche Startseite umgeleitet.
- Toasts sind als Statusmeldung markiert.

## Bewusst unverändert
- Supabase-Migrationen und Edge Functions
- Geschäftslogik des Backends
- vorhandene Deployment-Dateien
- bestehendes Styling

## Nächster Schritt
Diese Version zuerst lokal bauen/testen. Danach wird Schritt 2 auf genau dieser Struktur aufgebaut.
