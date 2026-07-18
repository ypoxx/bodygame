# AnatomyQuest – Phase-B-Untersuchungsdossiers der Stop-the-line-Fälle

Stand: 2026-07-15
Status: Untersuchung; **keine Freigabe**
Geltungsbereich: vier hart gesperrte Konzepte / acht Instanzen im gepinnten
Produktionsasset und im Mobile-LOD v2

## Entscheidung

Alle vier Konzepte bleiben fail-closed. Das gilt gleichermaßen für
`source_verified_mvp` und `published`:

1. `concept.soft_tissue.iliopsoas_fascia`
2. `concept.soft_tissue.tendon_of_extensor_digitorum_longus`
3. `concept.soft_tissue.trochanteric_bursa_of_gluteus_medius_muscle`
4. `concept.soft_tissue.iliocostalis_colli_muscle`

Die acht zugehörigen Einträge besitzen in
[`content/v2/runtime-index.json`](../content/v2/runtime-index.json) weiterhin
`learning: null`. Die Sperren stehen zentral in
[`src/anatomy/publicationBlocks.js`](../src/anatomy/publicationBlocks.js). Die
Pipeline-Prüfung verwirft für alle vier Konzepte sowohl eine vermeintliche
`source_verified_mvp`- als auch eine `published`-Projektion; die Explore-UI
weist dieselben Sperrgründe aus. Ein MVP ohne Human-Review hebt diese vier
Sperren ausdrücklich nicht auf.

## Evidenzbasis und Beweisgrenzen

### Gepinnte Quellen

| Quelle | Im Dossier zulässiger Beleg | Unzulässige Schlussfolgerung |
| --- | --- | --- |
| [FIPAT, *Terminologia Anatomica*, 2. Auflage, Version 2.07, Part II](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf) | exakter TA2-Term, lateinische und englische Primärspalte, Term-ID | Form, Lage, Ansatz, Funktion, Seitigkeit oder Korrektheit eines Meshes |
| Gepinntes `assets/muscles.glb` aus dem [offiziellen Z-Anatomy-Modellrepository](https://github.com/Z-Anatomy/Models-of-human-anatomy) | Existenz, exakter Knotenname, Transformation und messbare Geometrie des konkreten Assets | anatomische Identität oder medizinische Richtigkeit allein aus Name, Bounds oder Topologie |
| [Fascia Nomenclature Committee, Konsensbericht 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6852276/) | allgemeine Abgrenzung von „a fascia“ und „the fascial system“ | individuelle Lage, Kontinuität, Ansätze, Inhalte, Kraftübertragung oder Meshkorrektheit einer bestimmten Faszie |

Die offizielle [FIPAT-Veröffentlichungsseite](https://libraries.dal.ca/Fipat/ta2.html)
weist die unveränderte Gesamtpublikation als CC BY-ND 4.0 aus; die einzelnen
Terme sind laut FIPAT gemeinfrei. Der geprüfte lokale PDF-Snapshot hat SHA-256
`d30ce0d578b266ce4c47a6ff911e007a0cc440d65e9acaeb0680ec3eafa2231b`.
Die Locator im Projekt sind einbasierte PDF-Seite, TA2-Term-ID und Spalte.

Das Produktionsasset hat SHA-256
`99f2c7ac0e5fc01658b8432df589d677e1ac2a0b186166b62f72c5760a202396`.
Das Mobile-LOD v2 hat SHA-256
`fb3ba0e7a10fd5b439982e0c368f7e386b1677f4cc5368494c435e542d37cc3b`.
Provenienz und Exportparameter stehen in
[`assets/source-manifest.json`](../assets/source-manifest.json). Z-Anatomy
stellt Code und Inhalte unter CC BY-SA 4.0 bereit; die erforderlichen
Attributionen und zusätzlichen Herkunftshinweise stehen in
[`assets/ATTRIBUTION.md`](../assets/ATTRIBUTION.md) und im
[offiziellen License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt).
Das abgeleitete Mobile-LOD bleibt unter den einschlägigen ShareAlike-Bedingungen.

Der gepinnte JATS-Snapshot des Faszienkonsenses hat SHA-256
`96549999aa132f850aaf89fac4f7b2927537698b0ee3490c70df8de29e98cab3`
und steht unter CC BY 4.0. Für die allgemeine Klassifikationsgrenze sind die
exakten JATS-Locator `sectionId: ca23423-sec-0003` mit
`elementId: ca23423-tbl-0001` beziehungsweise
`elementId: ca23423-tbl-0002`. Der Snapshot ist im Quellenregister bewusst nur
für `classification`, nicht für `anatomical_claims`, zugelassen.

### Lokale Prüfungen

Herangezogen wurden:

- der [Release-Readiness-Bericht](release-readiness-2026-07-15.md);
- der [Phase-B-Inhalts- und Reviewplan](content-phase-b-review-plan.md);
- der [Faszien- und Bindegewebsaudit](../assets/derived/reports/fascia-audit.v2.md);
- der [Muskelbestandsbericht gegen TA2](../assets/derived/reports/muscle-completeness-ta2-audit.v1.md);
- der [Produktionsaudit](../assets/derived/reports/muscles.production.audit.json) und
  der [Mobile-LOD-v2-Audit](../assets/derived/reports/muscles.mobile-lod1.v2.json);
- die exakten [Konzept-Terminologiedaten](../content/v2/concepts/terminology.json)
  und [Instanzdaten](../content/v2/instances.json).

Zusätzlich wurden beide gepinnten GLBs mit Blender 5.0.1 headless und nur
lesend reimportiert. Für die acht Objekte wurden Welt-Bounds und
Transformationsdeterminanten gemessen. Für die vier gemeinsam genutzten
Meshressourcen wurden Dreiecke, über Kanten verbundene Komponenten,
Randkanten, Kanten mit mehr als zwei Flächennutzern und Flächen mit einer
Fläche von höchstens `1e-16` Modellflächeneinheiten gezählt. Kein Asset wurde
verändert. Diese Messungen prüfen den gespeicherten Modellzustand; sie sind
keine anatomische Validierung.

## Dossier 1 – Iliopsoasfaszie

Konzept: `concept.soft_tissue.iliopsoas_fascia`
Paket: `phase_b.connective_tissue.fasciae_arches_septa_tract`
Sperrcode: `iliopsoas_fascia_geometry_pair_anomaly`

### Beobachtete Evidenz

- Instanzen und exakte Asset-Locator:
  - `Iliopsoas_fascia_L` → `Iliopsoas fascia.l`, `side: left`;
  - `Iliopsoas_fascia_R` → `Iliopsoas fascia.r`, `side: right`.
- Beide Objekte verwenden dieselbe Produktions-Meshressource. Produktion:
  913 Vertices, 1.602 Dreiecke, 12 kantenverbundene Komponenten,
  202 Randkanten, keine Kante mit mehr als zwei Flächennutzern und keine im
  genannten Schwellwert flächenlose Fläche.
- Mobile-LOD v2: 373 Vertices, 559 Dreiecke, weiterhin 12 Komponenten,
  165 Randkanten, keine Kante mit mehr als zwei Flächennutzern und keine
  flächenlose Fläche im Prüfschwellwert.
- Produktions-Bounds-Mittelpunkte `(x, y, z)`:
  - `.l`: `(0.052032, -0.005998, 0.961218)`;
  - `.r`: `(-0.068057, -0.005998, 0.950469)`.
- Nach Spiegelung des rechten Mittelpunktes an der Modellmittelebene verbleibt
  zwischen den Mittelpunkten eine Abweichung von `0.016025` in der lateralen
  und `0.010749` in der vertikalen Modellkoordinate. Das entspricht der im
  Faszienaudit dokumentierten Größenordnung von ungefähr 16,0 mm und 10,7 mm.
- Im Mobile-LOD bleibt die Auffälligkeit praktisch unverändert:
  `0.016017` lateral und `0.010793` vertikal. Sie wurde somit nicht erst durch
  die LOD-Erzeugung eingeführt.
- FIPAT führt auf der einbasierten [PDF-Seite 66](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf#page=66)
  den Term 2386 `Fascia iliopsoae` / `Iliopsoas fascia`. Der strukturierte
  Terminologie-Locator lautet
  `{"kind":"pdf_term_row","pdfPage":66,"termId":2386,"column":"latin"}`
  beziehungsweise `column: "english_uk"`.

### Was damit belegt ist

- Im exakt gepinnten Asset existiert ein beidseitig benanntes Objektpaar.
- Der standardisierte TA2-Basisbegriff und seine lateinische Primärform sind
  exakt belegt.
- Die messbare Paarasymmetrie ist bereits im Produktionsasset vorhanden und
  wird im Mobile-LOD erhalten.
- Die 12 Komponenten und offenen Ränder sind reproduzierbare Eigenschaften des
  gespeicherten Meshes.

### Was nicht belegt ist

- Die Mittelpunktabweichung beweist für sich weder einen Fehler noch eine
  zulässige anatomische Asymmetrie.
- TA2 und der allgemeine Faszienkonsens enthalten keine Referenzgeometrie für
  diese beiden Meshes.
- Knotenname, gemeinsame Meshressource, Komponentenzahl und Bounds belegen
  weder Ausdehnung noch Kontinuitäten, Ansätze oder Nachbarschaften der
  Iliopsoasfaszie.
- Offene Ränder oder kleine getrennte Komponenten dürfen nicht automatisch
  geschlossen, verschweißt oder entfernt werden.

### Aktueller fail-closed-Entscheid

Das Konzept bleibt in beiden Veröffentlichungsstufen hart gesperrt. Die
vorhandene Terminologie darf die offene Assetfrage nicht überdecken. Es wird
weder eine Spiegelkorrektur noch eine Verschiebung aus Symmetrieannahmen
abgeleitet.

### Auflösungskriterien und Abnahmetests

Die Sperre darf erst nach gemeinsamem Erfüllen aller folgenden Punkte neu
bewertet werden:

1. Eine autoritative, wiederverwendbare Referenz für genau diese Struktur und
   Modellpose ist als unveränderlicher Snapshot mit Hash, Lizenz und präzisem
   Locator registriert. Eine allgemeine Fasziendefinition genügt nicht.
2. Beide Assetseiten werden getrennt gegen diese Referenz geprüft. Das Ergebnis
   dokumentiert, ob die Abweichung beabsichtigt, tolerierbar oder ein
   Quellassetfehler ist; eine zulässige Toleranz muss aus der Referenz und dem
   Modellmaßstab begründet werden und darf nicht nachträglich so gewählt
   werden, dass der aktuelle Wert besteht.
3. Es liegt eine explizite Assetentscheidung `unverändert lassen`,
   `transformieren`, `Mesh ersetzen` oder `aus Lernprojektion ausschließen`
   mit Autor-, unabhängigem Reviewer-, Quellen- und Hashbindung vor.
4. Bei einer Änderung werden Produktions-GLB, Mobile-LOD, Source-Manifest und
   Audits reproduzierbar neu erzeugt. Die 946 Instanzen und die exakten
   Selektions-IDs bleiben erhalten oder eine bewusst versionierte Migration
   deckt jede Abweichung ab.
5. Der Geometrietest protokolliert je Seite Bounds, Mittelpunktdifferenz,
   Komponenten, Randkanten, nichtmannigfaltige Kanten und flächenlose
   Dreiecke. Er erzwingt nicht blind perfekte Symmetrie, sondern den zuvor
   quellenbegründeten Sollzustand.
6. Front-/Rückansicht, Fokus, Isolation, Raycast-Auswahl und Mobile-LOD werden
   visuell und interaktiv geprüft; es darf keine neue Auswahl- oder
   Sichtbarkeitsregression geben.
7. Erst danach darf der Sperrcode in einer eigenen, getesteten Änderung
   entfernt werden. Fehlende Referenz, fehlender Locator oder geänderter Hash
   müssen weiterhin fail-closed enden.

## Dossier 2 – Sehne des Extensor digitorum longus

Konzept: `concept.soft_tissue.tendon_of_extensor_digitorum_longus`
Paket: `phase_b.connective_tissue.retinacula_tendons_ligaments_special`
Sperrcode: `derived_extensor_digitorum_longus_tendon`

### Beobachtete Evidenz

- Instanzen und exakte Asset-Locator:
  - `Tendon_of_extensor_digitorum_longus_L` →
    `Tendon of extensor digitorum longus.l`, `side: left`;
  - `Tendon_of_extensor_digitorum_longus_R` →
    `Tendon of extensor digitorum longus.r`, `side: right`.
- Beide Seiten sind exakte Spiegelinstanzen derselben Produktions-Meshressource.
  Ihre Bounds-Mittelpunkte sind
  `(0.115639, -0.054046, 0.053843)` und
  `(-0.115639, -0.054046, 0.053843)`.
- Produktion: 2.843 Vertices, 5.184 Dreiecke, vier kantenverbundene
  Komponenten mit 738, 725, 704 und 676 Vertices, 494 Randkanten, keine Kante
  mit mehr als zwei Flächennutzern und keine flächenlose Fläche im
  Prüfschwellwert.
- Mobile-LOD v2: 1.107 Vertices, 1.814 Dreiecke, weiterhin vier Komponenten,
  392 Randkanten, keine Kante mit mehr als zwei Flächennutzern und keine
  flächenlose Fläche im Prüfschwellwert. Die Spiegelbeziehung bleibt erhalten.
- Das Konzept ist im Projekt ausdrücklich `derived_structure`. Die
  Assetbezeichnung besitzt keinen eigenen TA2-Primärterm im gepinnten
  Vollauszug.
- Der verknüpfte [TA2-Term 2645 auf PDF-Seite 75](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf#page=75)
  lautet `Extensor longus digitorum` / `Extensor digitorum longus` und benennt
  den Muskel, nicht das separat modellierte Sehnenobjekt. Der gespeicherte
  Locator bindet ausschließlich diese Beziehung:
  `{"kind":"pdf_term_row","pdfPage":75,"termId":2645,"column":"latin"}`.
- TA2 führt anschließend mit 2646–2648 `Aponeurosis extensoria pedis` /
  `Extensor expansion of foot` und deren benannte Bänder sowie mit 2758
  `Vagina tendinum extensoris longi digitorum` / `Tendon sheath of extensor
  digitorum longus`. Keiner dieser Nachbarterme darf allein aufgrund
  räumlicher oder sprachlicher Nähe auf das Mesh übertragen werden.

### Was damit belegt ist

- Das gepinnte Asset enthält je Seite ein separat auswählbares Mesh mit dem
  genannten Arbeitslabel, das technisch in vier kantenverbundene Komponenten
  zerfällt.
- Produktions- und Mobile-Geometrie erhalten Paarung und Komponentenzahl.
- TA2 2645 belegt den offiziellen Namen des zugehörigen Muskels und damit die
  dokumentierte Ableitungsbeziehung.

### Was nicht belegt ist

- TA2 2645 ist kein Terminologiebeleg für einen eigenen Sehnenbegriff und darf
  insbesondere nicht als lateinischer Name der Sehne angezeigt werden.
- Vier Meshkomponenten belegen ohne anatomische Referenz weder vier bestimmte
  Sehnenzüge noch deren Zielstrukturen, Ansätze oder Vollständigkeit.
- Das Assetlabel beweist nicht, ob das Objekt eine gemeinsame Sehne, mehrere
  Sehnen, Teile einer Extensorenaponeurose oder eine andere Modellabgrenzung
  repräsentiert.
- Ein symmetrisches Paar und saubere Grundtopologie lösen die
  Identitäts- und Benennungsfrage nicht.

### Aktueller fail-closed-Entscheid

Das Konzept bleibt eine abgeleitete Modellstruktur ohne eigenen TA2-Namen. Die
UI zeigt für sie keinen aus dem Muskelterm übernommenen lateinischen Namen;
`learning` bleibt `null`. Eine grammatisch erzeugte lateinische Form ist
unzulässig.

### Auflösungskriterien und Abnahmetests

1. Die ursprüngliche Objektabsicht und alle vier Komponenten werden anhand
   einer gepinnten anatomischen Quelle und, soweit verfügbar, der
   Quellmodell-Provenienz einzeln identifiziert. Jeder Befund benötigt einen
   präzisen Locator; das Arbeitslabel ist kein Locator für Anatomieclaims.
2. Es wird ausdrücklich entschieden, ob das Konzept
   - als quellenbelegte, aber nicht in TA2 enumerierte Modellstruktur bestehen
     bleibt,
   - in mehrere Konzepte aufgeteilt wird,
   - einem tatsächlich passenden offiziellen Term zugeordnet wird oder
   - keine Lernprojektion erhält.
3. Für eine abgeleitete Benennung wird die Provenienz als solche sichtbar
   gehalten. Es wird weder eine TA2-ID noch ein `preferredLatin` erfunden oder
   von TA2 2645 geerbt.
4. Anatomische Pflichtclaims für eine Sehne werden atomar und mit
   `anatomical_claims`-fähigen Quellen belegt; Muskelclaims dürfen nicht
   ungeprüft auf das Sehnenobjekt übertragen werden.
5. Ein Komponententest deckt alle vier Produktionskomponenten und ihre vier
   Mobile-Entsprechungen ab und erkennt unbeabsichtigtes Zusammenführen,
   Auftrennen oder Wegfallen. Bounds, Randkanten, nichtmannigfaltige Kanten und
   flächenlose Dreiecke werden erneut protokolliert.
6. Ein Terminologietest muss weiterhin verhindern, dass TA2 2645 oder dessen
   lateinischer Muskelname als eigener Sehnenname erscheint. Erst eine
   dokumentierte Terminologieentscheidung darf diese Negativprüfung ersetzen.
7. Suche, Auswahl, Fokus und Isolation werden auf beiden Seiten getestet. Eine
   etwaige Aufteilung braucht eine versionierte Zuordnung aller bisherigen
   Selektions-IDs.

## Dossier 3 – Trochanterische Bursa/Bursae des Gluteus medius

Konzept:
`concept.soft_tissue.trochanteric_bursa_of_gluteus_medius_muscle`
Paket: `phase_b.connective_tissue.lower_extremity_bursae_sheaths`
Sperrcode: `trochanteric_bursa_singular_plural_ambiguity`

### Beobachtete Evidenz

- Instanzen und exakte Asset-Locator:
  - `Trochanteric_bursa_of_gluteus_medius_muscle_L` →
    `Trochanteric bursa of gluteus medius muscle.l`, `side: left`;
  - `Trochanteric_bursa_of_gluteus_medius_muscle_R` →
    `Trochanteric bursa of gluteus medius muscle.r`, `side: right`.
- Die beiden Objekte sind exakte Spiegelinstanzen derselben Meshressource.
  Ihre Produktions-Bounds-Mittelpunkte sind
  `(0.138258, 0.029241, 0.846018)` und
  `(-0.138258, 0.029241, 0.846018)`.
- Produktion: 219 Vertices, 352 Dreiecke, eine kantenverbundene Komponente,
  84 Randkanten, keine Kante mit mehr als zwei Flächennutzern und keine
  flächenlose Fläche im Prüfschwellwert.
- Das Mesh liegt unter der Schutzgrenze von 400 Dreiecken und wurde im
  Mobile-LOD nicht vereinfacht. Mobile v2 besitzt dieselben 219 Vertices,
  352 Dreiecke, eine Komponente und 84 Randkanten; die Bounds bleiben bis auf
  Rundung identisch.
- Das Assetlabel steht im Singular. FIPAT führt dagegen auf der einbasierten
  [PDF-Seite 78](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf#page=78)
  den Term 2725 ausdrücklich im Plural:
  `Bursae trochantericae musculi glutei medii` / `Trochanteric bursae of
  gluteus medius muscle`.
- Die unmittelbar benachbarten TA2-Terme 2724 für Gluteus maximus und 2726 für
  Gluteus minimus stehen jeweils im Singular. Der Singular/Plural-Unterschied
  bei 2725 ist deshalb nicht als bloße generische Kapitelüberschrift zu
  behandeln.
- Der gespeicherte Kandidaten-Locator ist
  `{"kind":"pdf_term_row","pdfPage":78,"termId":2725,"column":"latin"}`
  beziehungsweise `column: "english_uk"`; die Zuordnung trägt weiterhin
  `expert_review_required` und `singular_asset_for_plural_official_term`.

### Was damit belegt ist

- Das Asset enthält pro Seite genau einen Objektknoten und eine zusammenhängende
  Meshressource unter einem singulären Arbeitslabel.
- TA2 2725 ist ein pluraler Normbegriff; die lateinische und englische
  Primärspalte stimmen darin überein.
- Das unveränderte Mobile-Mesh führt keine zusätzliche Granularitätsänderung
  ein.

### Was nicht belegt ist

- Eine zusammenhängende offene Meshfläche beweist nicht, wie viele anatomische
  Bursen oder Teilräume dargestellt werden.
- Umgekehrt beweist der plurale TA2-Term nicht, dass ein Modell zwingend mehrere
  getrennte Meshkomponenten besitzen muss.
- Weder das singuläre Assetlabel noch die räumliche Nähe zum Gluteus medius
  belegen, dass das Mesh den vollständigen Umfang von TA2 2725 repräsentiert.
- Die 84 Randkanten dürfen bei einer Bursa nicht automatisch als Defekt
  behandelt oder geschlossen werden; der Faszienaudit warnt ausdrücklich vor
  automatischem Solidifizieren offener Bursenflächen.

### Aktueller fail-closed-Entscheid

Die mögliche TA2-Zuordnung bleibt verborgen und das Konzept bleibt hart
gesperrt. Weder wird der singuläre Assetname ungeprüft zum pluralen Normbegriff
erweitert noch der plurale Normbegriff auf ein möglicherweise unvollständiges
Einzelmesh verengt.

### Auflösungskriterien und Abnahmetests

1. Eine autoritative, gepinnte Quelle mit genauer Fundstelle beschreibt die
   unter dem Gluteus medius gemeinte Bursa-Granularität. Zusätzlich wird die
   ursprüngliche Modellprovenienz des konkreten Knotens geprüft.
2. Die vorhandene Meshfläche wird in derselben Modellpose gegen diese Referenz
   abgeglichen. Dokumentiert wird, ob sie eine einzelne Bursa, einen Verbund,
   mehrere nicht getrennte Anteile oder nur einen Teil des pluralen TA2-Konzepts
   repräsentiert.
3. Auf dieser Basis wird eine der folgenden Modellentscheidungen getroffen:
   singuläre abgeleitete Struktur ohne TA2-2725-Gleichsetzung, pluraler
   Aggregatbegriff mit nachgewiesener Abdeckung, Aufteilung/Ergänzung der
   Meshes oder Ausschluss aus der Lernprojektion.
4. Name, Numerus, Konzeptgrenze und Mesh-Mapping müssen dieselbe Entscheidung
   abbilden. Ein pluraler Name bei nur teilweise belegter Geometrie und ein
   singulärer Name mit unzulässig geerbter TA2-ID bleiben gesperrt.
5. Ein Abdeckungstest prüft die quellenbegründete Zahl und Zuordnung der
   modellierten Anteile. Der technische Baselinewert ist aktuell eine
   Komponente pro gemeinsam genutzter Meshressource; eine Änderung muss
   ausdrücklich begründet sein.
6. Topologietests protokollieren Randkanten, nichtmannigfaltige Kanten und
   flächenlose Dreiecke, schließen die offene Oberfläche aber nicht
   automatisch. Produktions- und Mobile-Repräsentation müssen dieselbe
   freigegebene Granularität besitzen.
7. UI-Negativtests halten offiziellen Plural und lateinischen Namen verborgen,
   solange Terminologie- oder Geometrieentscheidung fehlt. Auswahl, Fokus und
   Isolation werden anschließend beidseitig geprüft.

## Dossier 4 – Iliocostalis colli

Konzept: `concept.soft_tissue.iliocostalis_colli_muscle`
Paket: `phase_b.muscles.back`
Sperrcode: `iliocostalis_colli_unresolved_laterality`

### Beobachtete Evidenz

- Instanzen und exakte Asset-Locator:
  - `Iliocostalis_colli_muscle` → `Iliocostalis colli muscle`;
  - `Iliocostalis_colli_muscle_R` → `Iliocostalis colli muscle.r`.
- Wegen des fehlenden `.l`-Suffixes der ersten Instanz stehen **beide**
  Einträge in `content/v2/instances.json` bewusst auf `side: unresolved`.
- Beide Objekte nutzen dieselbe Meshressource und sind geometrisch exakte
  Spiegelinstanzen:
  - Produktion: Mittelpunkte
    `(0.049720, 0.053473, 1.403738)` und
    `(-0.049720, 0.053473, 1.403738)`;
  - Transformationsdeterminanten `-1.0` und `+1.0`;
  - 1.027 Vertices, 2.050 Dreiecke, eine kantenverbundene Komponente,
    keine Randkante, keine Kante mit mehr als zwei Flächennutzern und keine
    flächenlose Fläche im Prüfschwellwert.
- Mobile-LOD v2: Mittelpunkte
  `(0.049793, 0.053641, 1.403755)` und
  `(-0.049793, 0.053641, 1.403755)`, 360 Vertices, 716 Dreiecke, weiterhin
  eine Komponente ohne Rand-, nichtmannigfaltige oder flächenlose Elemente im
  Prüfschwellwert.
- FIPAT führt auf der einbasierten
  [PDF-Seite 62](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf#page=62)
  Term 2261 `Musculus iliocostalis colli` / `Iliocostalis colli muscle`.
  Der gespeicherte Locator lautet
  `{"kind":"pdf_term_row","pdfPage":62,"termId":2261,"column":"latin"}`
  beziehungsweise `column: "english_uk"`.

### Was damit belegt ist

- Der offizielle, seitenneutrale Muskelbegriff ist exakt belegt.
- Das Produktionsasset enthält ein geometrisch spiegelgleiches Paar; das
  Mobile-LOD bewahrt diese Paarung und beide Knoten.
- Der zweite Knoten trägt im Asset den Suffix `.r`; der erste trägt keinen
  komplementären Seitensuffix.

### Was nicht belegt ist

- Die Symmetrie allein kodiert keine anatomische Seitigkeit.
- Die Annahme „positive x-Koordinate bedeutet links“ darf nicht allein aus
  anderen Knotennamen oder aus der Renderansicht auf dieses Konzept übertragen
  werden. Sie braucht einen gepinnten, assetweiten Konventionsnachweis.
- Das `.r`-Label des zweiten Knotens löst nicht automatisch die vollständige
  zweistellige Release-State-Zuordnung, solange der erste Knoten und die
  Quellenprovenienz ungeklärt sind.
- TA2 2261 enthält keine Instanzseitigkeit und validiert keine Meshgeometrie.

### Aktueller fail-closed-Entscheid

Beide Instanzen bleiben `side: unresolved`; das Konzept erhält keine
Lernprojektion. Die starke geometrische Evidenz für ein Paar ist ein
Prüfhinweis, aber noch keine quellengebundene Seitenentscheidung.

### Auflösungskriterien und Abnahmetests

1. Die Achsen- und Seitenkonvention des exakt gepinnten Produktionsassets wird
   anhand einer vorab definierten Stichprobe eindeutig beschrifteter,
   anatomisch asymmetrisch identifizierbarer Referenzstrukturen und – soweit
   verfügbar – der Quellscene dokumentiert. Ein bloßer Mehrheitsvergleich von
   `.l`/`.r`-Suffixen reicht nicht.
2. Für beide Instanz-IDs wird eine explizite Seitenzuordnung mit
   Asset-Source-ID, exaktem Meshknoten-Locator, Evidenzartefakt und aktuellem
   Release-State-Hash gespeichert. Die unsuffigierte Instanz wird nicht allein
   per Stringregel umbenannt.
3. Ein negativer Test stellt sicher, dass fehlende oder widersprüchliche
   Achsen-/Quellenevidenz weiterhin beide Instanzen sperrt. Ein positiver Test
   erwartet nach dokumentierter Auflösung genau eine linke und eine rechte
   Instanz, niemals zwei gleiche Seiten.
4. Der Paarprüfung zufolge müssen beide Knoten, gemeinsame Meshzuordnung und
   spiegelbildliche Bounds in Produktion und Mobile vorhanden bleiben, sofern
   die Referenz keine begründete Assetkorrektur verlangt.
5. Auswahl, Front-/Rückansicht, Fokus, Isolation, Suchresultat und
   Screenreader-Seitenbezeichnung werden für beide Seiten geprüft.
6. Erst nach bestandener Release-State-, Terminologie-, Asset- und UI-Prüfung
   darf der Sperrcode in einer eigenen, regressionsgetesteten Änderung entfernt
   werden.

## Gemeinsame Freigabesperre und Nachweisformat

Die folgenden Bedingungen sind für jeden Stopfall zusätzlich zu den
fallspezifischen Kriterien zwingend:

- Quelle, Version, Abrufdatum, Rechteumfang und SHA-256 sind registriert und
  lokal gegen den Snapshot verifiziert.
- Jede terminologische oder anatomische Aussage hat einen strukturierten,
  maschinenprüfbaren Locator. Ein URL-, Kapitel- oder Assetname ohne exakte
  Fundstelle genügt nicht.
- Der Assetname dient nur als `mesh_identity`/`geometry_provenance`, nicht als
  `anatomical_claims`-Quelle.
- Klassifikation, Region, Seitigkeit und Mapping aller betroffenen Instanzen
  liegen vollständig im stufengerechten Release-State vor.
- Autor und Reviewer sind getrennt; ein MVP-Review beansprucht keine
  Human-Rolle und überschreibt keinen späteren Human-Review.
- Eine technische Abweichung wird nicht still normalisiert. Asset-, Konzept-
  oder Instanzänderungen benötigen eine versionierte Migration und neue
  Hashbindungen.
- Erst die explizite Entfernung genau eines begründet aufgelösten Sperrcodes
  darf eine Lernprojektion ermöglichen. Die anderen drei Stopfälle bleiben
  unabhängig davon gesperrt.

Nach einer späteren Auflösungsänderung ist mindestens diese vollständige
Prüffolge auszuführen:

1. Snapshot-Hashprüfung aller verwendeten Quellen;
2. deterministische Content-v2-Regeneration und `content:v2:check`;
3. Legacy- und v2-Validatoren;
4. sämtliche Daten-, Gate-, Terminologie- und Explore-UI-Tests;
5. Produktions-/Mobile-GLB-Audit einschließlich der fallspezifischen
   Geometrieinvarianten;
6. Performance-Smoke-Test und Netlify-Bundle-Build;
7. Browser-QA mindestens bei 390×844 und 320×568 mit Suche, Auswahl, Fokus,
   Isolation, Vorder-/Rückansicht und Lernkarte;
8. `git diff --check` und Prüfung, dass die bestehende Produktion bis zu einer
   bewusst autorisierten Veröffentlichung unverändert bleibt.

Ein bestandener technischer Test ersetzt keine fehlende Quellenevidenz. Eine
gefundene Quelle ersetzt umgekehrt keine Prüfung, ob sie genau das konkrete
Mesh, seine Granularität und seine Seitigkeit tatsächlich belegt.
