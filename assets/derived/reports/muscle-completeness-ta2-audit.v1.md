# Muskelbestandsprüfung gegen FIPAT TA2 2.07

**Stand:** 15. Juli 2026
**Status:** technische Bestandsprüfung; keine medizinische Fachfreigabe

## Ergebnis

Die aktuelle Anwendung enthält **232 direkt selektierbare Muskelkonzepte mit
462 Instanzen**. Alle 462 erwarteten Muskel-Knotennamen kommen sowohl in
`assets/muscles.glb` als auch in
`assets/derived/muscles.mobile-lod1.v2.glb` exakt vor. Damit gingen bei der
Mobile-LOD-Erzeugung **0 Muskelinstanzen verloren**.

Der Bestand ist dennoch nicht als vollständige Umsetzung aller in TA2
aufgeführten Muskel- und Muskelteilbegriffe zu verstehen. Ganze Muskeln sind im
Quellasset teilweise nur durch ihre Köpfe oder Teile modelliert; weitere
benannte Muskeln und Untergliederungen besitzen keinen eigenen selektierbaren
Mesh-Knoten. Diese Unterschiede sind eine Eigenschaft des zugrunde liegenden
Quellassets und keine LOD-Regression.

## Methode und Quellenbindung

- Referenz: [FIPAT Terminologia Anatomica, Second Edition, Version 2.07,
  Part II](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf).
- Die verwendete PDF stimmte exakt mit dem im Projekt registrierten SHA-256
  `d30ce0d578b266ce4c47a6ff911e007a0cc440d65e9acaeb0680ec3eafa2231b`
  überein.
- Der Vollauszug enthielt 2.421 Part-II-Zeilen. Kapitel IV, Muskelsystem,
  umfasst 798 IDs von 1974 bis 2771; ID 2259 ist in der PDF leer.
- Die 232 Projektkonzepte verwenden 232 verschiedene Part-II-Term-IDs. Ihre
  Primärbegriffe sind im derzeitigen Projektstand alle als `exact_v2_07` und
  `machine_verified` abgebildet. Das belegt die deterministische
  Begriffszuordnung, nicht deren medizinische Fachfreigabe.
- Produktions- und Mobile-GLB wurden direkt ausgelesen und ihre Mesh-Knotennamen
  gegen `content/v2/instances.json` verglichen. Zusätzlich wurden Pipeline- und
  Reimport-Reports herangezogen.

Wesentliche lokale Evidenz:

- `assets/source-manifest.json`
- `assets/derived/reports/muscles.production.audit.json`
- `assets/derived/reports/muscles.mobile-lod1.v2.json`
- `assets/derived/reports/muscles.mobile-lod1.v2.visual.json`
- `content/v2/concepts/terminology.json`
- `content/v2/terminology/ta2-2.07-selected-primary-terms.json`
- `content/v2/reviews/terminology.json`
- `content/v2/reviews/classification.json`

## Produktionsmodell und Mobile-LOD

| Prüfpunkt | Produktion | Mobile LOD v2 |
|---|---:|---:|
| Weichteil-Mesh-Knoten gesamt | 669 | 669 |
| davon Muskelinstanzen | 462 | 462 |
| davon Bindegewebsinstanzen | 207 | 207 |
| eindeutige Mesh-Ressourcen | 337 | 337 |
| gegen Soll fehlende Muskel-Knotennamen | 0 | 0 |
| instanziierte Dreiecke | 2.137.457 | 775.245 |

Die Mobile-LOD enthält damit 36,2695 % der instanziierten Dreiecke des
Produktionsmodells. Objektanzahl, Objektbezeichnungen und
Objekt-Mesh-Zuordnungen wurden laut Reimport-Report bewahrt. Der gespeicherte
Frontvergleich erreicht 44,17 dB PSNR. Das ist ein technischer
Identitäts-/Darstellungsnachweis, keine anatomische Validierung.

## Brust

- Direkt vorhanden: **13 Konzepte / 25 Mesh-Instanzen** im TA2-Thoraxbereich.
- Der Elternbegriff **Pectoralis major muscle** (TA2 2301) besitzt keinen
  zusätzlichen Gesamtmesh. Er ist durch drei beidseitig selektierbare Teile
  vertreten: claviculärer Kopf (2302), sternokostaler Kopf (2303) und der in
  TA2 geklammerte abdominale Teil (2304).
- Ebenfalls direkt vorhanden sind unter anderem Pectoralis minor, Subclavius,
  Serratus anterior, die drei Interkostalmuskel-Serien, Levatores costarum
  longi/breves, Transversus thoracis und das Diaphragma.
- Ohne eigenen Selektionsknoten bleiben der optionale Sternalis (2300) sowie
  acht getrennte rechte/linke Muskel- und Teilbegriffe des Hemidiaphragmas
  (2330/2331/2336/2337 und 2345/2346/2351/2352). Das Gesamt-Diaphragma ist
  vorhanden.
- Die Serie **Subcostal muscles** (2314) ist nicht separat modelliert.

Damit war die zuvor fehlende Brustdarstellung kein Verlust von Brustmeshes.
Die aktuelle Datenstruktur zeigt den Pectoralis major lediglich auf der
feineren Ebene seiner modellierten Teile.

## Rücken

- Direkt vorhanden: **35 Konzepte / 70 Mesh-Instanzen** im TA2-Rückenbereich.
- **Trapezius muscle** (2226) ist als Elternbegriff nicht zusätzlich modelliert,
  aber durch descendens, transversa und ascendens beidseitig vertreten.
- **Erector spinae** (2254) besitzt keinen Gesamtmesh; die modellierten
  Iliocostalis-, Longissimus- und Spinalis-Untergliederungen repräsentieren
  diesen Elternbegriff.
- Direkt vorhanden sind außerdem unter anderem Latissimus dorsi, Rhomboideus
  major/minor, Levator scapulae, Serratus posterior superior/inferior,
  Splenii, Multifidi und Teile der Semispinales.

Benannte Rückenlücken ohne eigenen selektierbaren Mesh-Knoten:

1. **Lumbar part of longissimus thoracis muscle** (2264)
2. **Semispinalis capitis muscle** (2283)
3. **Transversus nuchae muscle** (2230; in TA2 geklammerter optionaler Term)

Nicht separat modellierte Serien umfassen unter anderem die
Intertransversarii-Einträge 2237, 2238 und 2295–2297 sowie die
Rotatores-Unterserien 2285–2289. Das seitlich aggregierte Konzept Rotatores
(2284) ist dagegen vorhanden.

## Arbeitsklassifikation des TA2-Kapitels

Die folgende Aufteilung ist eine nachvollziehbare, aber nicht medizinisch
reviewte Arbeitsklassifikation. Sie nutzt TA2-Reihenfolge, Singular/Plural und
explizite Bezeichnungen wie `Pars`, `Caput`, `Venter` und `Fasciculus`; die PDF
liefert keine maschinenlesbaren Ontologieklassen oder Elternkanten.

| Kategorie | Anzahl | Bedeutung |
|---|---:|---|
| A | 232 | direkt selektierbarer Projektbegriff; darunter 168 ganze/singuläre Begriffe, 47 Teile/Köpfe/Bäuche und 17 Serienaggregate |
| B | 28 | Elternmuskel ohne eigenen Gesamtmesh, aber durch mindestens einen benannten Teil oder eine Untergliederung repräsentiert |
| C | 93 | benannter individueller Muskel oder expliziter Muskelteil ohne eigenen selektierbaren Mesh-Knoten; darunter 9 geklammerte optionale und 7 geschlechtsspezifische Terme |
| D | 445 | allgemeine Morphologie, Systeme/Überschriften, Faszien, Sehnen, Bursen, Retinacula, Kompartimente, weitere Serien/Gruppen sowie die leere ID 2259 |

Die größeren Lückenblöcke der Kategorie C liegen vor allem bei Kopf/Hals
und Becken/Perineum, beispielsweise bei Ohr-, Zungen-, Gaumen- und
Perinealmuskeln. Daraus folgt: Das Quellasset bietet eine breite, aber keine
TA2-vollständige selektierbare Muskelabdeckung. Die 93 Begriffe dürfen nicht
pauschal als 93 fehlende große Muskeln interpretiert werden, da die Menge auch
Unterteile, optionale Varianten und geschlechtsspezifische Strukturen enthält.

## Grenzen und Freigabe

TA2 ist eine Terminologiequelle. Ein passender Name oder eine passende Term-ID
bestätigt weder Form, Ansatz, Ursprung, Lage, Seitigkeit noch topologische
Qualität eines Meshes. Auch Namens- und Bounds-Erhalt bei der LOD-Erzeugung
belegen keine anatomische Richtigkeit. Insbesondere bleibt die Seitigkeit der
beiden Iliocostalis-colli-Instanzen im Projektdatensatz ungeklärt.

Vor einer Aussage wie "medizinisch vollständig und korrekt" sind daher eine
unabhängige anatomische Sichtprüfung der Geometrien, eine fachliche Entscheidung
über den gewünschten Granularitätsgrad und die bereits in den Review-Ledgern
ausstehende Terminologie-/Klassifikationsfreigabe erforderlich.
