# AnatomyQuest

Mobile-first Web-App zum Erkunden und spielerischen Lernen menschlicher Anatomie in 3D.

## Features im aktuellen Stand

- Mobile 3D-Exploration mit Einfinger-Rotation und Zweifinger-Zoom (Three.js r185)
- Klick-/Touch-Auswahl via Raycasting
- Drei Spielmodi: `Speedrun`, `Sudden Death`, `Precision`
- Mutator-Engine pro Runde (`Gespiegelt`, `Combo ×2`, `Zeitsog`); Kamera-Zoom bleibt immer verfügbar
- Bonusrunden-Mechanik in regelmäßigen Intervallen
- Kompaktes Runden-HUD mit Countdown, Combo, Multiplikator und Leben
- Layer-System: Knochen, Muskeln, Faszien
- Darstellungs-System (`Atelier`, `Lehrsaal`) mit Runtime-Umschaltung
- Smart-Zoom für kleine Strukturen außerhalb aktiver Runden
- Adaptiver Pixel-Ratio-Cap und reduzierte Renderfrequenz für Mobile
- Direkte WebGL-Pipeline mit ACES, sRGB, RoomEnvironment und günstiger Auswahlkontur
- Skelett zuerst, Muskelmodell progressiv im Leerlauf
- Daily/Weekly Challenges (seed-basiert)
- Progression (XP/Level/Badges), Ghost Replay und lokales Leaderboard
- Sammelkarten-Freischaltung mit Fun Facts
- Sound-Cues (WebAudio) mit On/Off-Schalter
- Lokale Speicherung via `localStorage` (Bestwerte pro Modus, Unlocks, Profil, Sound, Learning, Progression, Telemetrie)
- PWA-Basis mit `manifest.json` und Service Worker

## Schnellstart

1. Abhängigkeiten installieren: `npm install`
2. Produktionsbundle erzeugen: `npm run build`
3. `dist/` über einen lokalen HTTP-Server öffnen, z. B. `python3 -m http.server 8000 --directory dist`

Der Build legt die exakt verwendeten Three.js-r185-Module lokal unter `dist/vendor/` ab. Die App besitzt dadurch zur Laufzeit keine CDN-Abhängigkeit.

## Netlify

- Produktionsbundle lokal erstellen: `npm run build`
- Nur `dist/` wird veröffentlicht; große GLB-Backups bleiben lokal.
- Preview inklusive Build: `npx netlify deploy --build`
- Produktion nach Prüfung: `npx netlify deploy --build --prod`
- Build- und Headerkonfiguration: `netlify.toml`

## Entwicklungsstruktur (Codex-freundlich)

- Entry: `app.js`
- Module unter `src/`:
  - `src/core/eventBus.js`
  - `src/state/store.js`
  - `src/theme/*`
  - `src/engine/*`
  - `src/game/*`
  - `src/audio/audioEngine.js`
  - `src/ui/onboarding.js`
  - `src/progression/progression.js`
  - `src/learning/adaptiveSelector.js`
  - `src/challenges/challengeEngine.js`
  - `src/competition/*`
  - `src/telemetry/events.js`

## Content Pipeline

- Strukturdaten: `content/structures.json`
- Schema: `content/schema.structures.json`
- Auto-Generierung aus GLB-Assets:
  - `node scripts/generate-content-from-assets.mjs`
  - erzeugt synchron:
    - `content/structures.json` (mit `layer` + `tags`)
    - `quizdata.json` (Quiz-Projection)
- Validierung:
  - `node scripts/validate-content.mjs`
- Perf-Smoke:
  - `node scripts/perf-smoke.mjs`

## Modelltausch

- Standard:
  - `assets/skeleton.glb`
  - `assets/muscles.glb`
- Optional für Profilwahl:
  - `assets/skeleton_male.glb`
  - `assets/muscles_male.glb`
  - `assets/skeleton_female.glb`
  - `assets/muscles_female.glb`
- Achte auf eindeutige Meshnamen wie `Femur`, `Patella_L`, `Vertebra_C1`.
- Für Draco-komprimierte GLBs sind lokale Decoder unter `assets/draco/` eingebunden.

Auf schmalen Displays, Geräten mit grobem Zeiger, wenig Arbeitsspeicher oder Datensparmodus lädt die App zuerst die visuell geprüften Mobile-LODs. Auf großen Geräten lädt sie zuerst die Produktionsmodelle in voller Auflösung; beide Pfade besitzen jeweils einen automatischen Fallback.

## Aktueller Asset-Stand

- `assets/skeleton.glb`: aus Z-Anatomy exportiert und Draco-komprimiert
- `assets/muscles.glb`: aus Z-Biomechanics exportiert und Draco-komprimiert
- Historische Vollszenen-Sicherungen liegen als:
  - `assets/skeleton.uncompressed.backup.glb`
  - `assets/muscles.uncompressed.backup.glb`

Die aktuellen GLBs besitzen bereits genügend Detail und Custom Normals. Draco reduziert nur die Downloadgröße; nach dem Dekodieren bleibt die volle GPU-Last. Für weitere Asset-Optimierung sind deshalb LODs, Draw-Call-Reduktion und eine gezielte Reparatur der beiden Triangle-Soup-Strukturen `External abdominal oblique muscle` und `Multifidus thoracis muscle` wichtiger als zusätzliche Polygone oder höhere Quantisierung. Die vorhandenen „uncompressed backups“ sind keine 1:1-Master der aktuellen kuratierten Dateien und sollten nicht blind neu exportiert werden.

Mobile LOD1-Dateien liegen getrennt unter `assets/derived/`. Sie lassen sich aus
den hash-fixierten Produktions-GLBs reproduzieren:

```sh
bash scripts/build-mobile-lods.sh
```

Pipeline, Messergebnisse, visuelle Vergleiche und die noch offene echte
Master-Quellenfrage sind in `assets/derived/README.md` dokumentiert. Herkunft
und ShareAlike-Hinweise stehen in `assets/ATTRIBUTION.md` und
`assets/source-manifest.json`.

## Quizdaten erweitern

- Quelle: `content/structures.json`
- Danach `quizdata.json` per Generator aktualisieren:
  - `node scripts/generate-content-from-assets.mjs`

## Hinweis zur PWA

- Service Worker funktionieren nicht mit `file://`.
- Für Offline/PWA immer über `http://localhost` testen.
- Bei größeren UI-Updates gegebenenfalls hart neu laden (SW-Cache).
