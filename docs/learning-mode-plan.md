# AnatomyQuest – Umsetzungs- und Prüfplan für den mobilen Entdecken-Modus

Status: verbindliche Arbeitsgrundlage; Phase-A-Grundlage implementiert
Stand: 2026-07-15
Primärgerät: Smartphone, Touch-Bedienung
Bestand: 946 selektierbare Mesh-Instanzen

Hinweis zum Implementierungsstand: Die ursprüngliche Zielarchitektur wurde für
die sichere Phase-B-Kuration bewusst als flache, deterministisch generierte
Runtime umgesetzt. Maßgeblich sind `content/v2/runtime-index.json`,
`content/v2/curated/` und die getrennten Reviewdateien. Die nachfolgende
Verzeichnisdarstellung ist an diesen realen Stand angeglichen.

## 1. Zielbild

AnatomyQuest startet künftig im ruhigen, explorativen Modus **Entdecken**. Der
bestehende Quizbereich bleibt als zweite Erfahrung erhalten, wird aber nicht
mit dem Entdecken-Zustand vermischt.

Der Entdecken-Modus bietet:

- einen deutlich größeren, frei dreh- und per Pinch-Geste zoombaren 3D-Körper;
- exakte Auswahl jeder im Modell vorhandenen Struktur;
- Suche über deutsche, lateinische und gebräuchliche alternative Namen;
- sichtbare Filter für Rendergruppen und anatomische Regionen;
- Fokus, Isolation, Vorder-/Rückansicht und Zurücksetzen als explizite
  Bedienelemente;
- eine halbhohe Lernkarte mit quellenbelegten, typgerechten Informationen;
- einen freiwilligen Übergang „Im Quiz üben“.

Das visuelle Referenzkonzept liegt unter
`docs/design/learning-mode-mobile-concept.png`.

## 2. Harte Produktentscheidungen

### 2.1 Entdecken ist kein vierter Spielmodus

Über den bisherigen Quizmodi wird ein eigener Zustand eingeführt:

```js
experienceMode: "explore" | "quiz"
```

`explore` ist der Standard. Timer, Punkte, Leben, Combo, Challenges,
Rundensteuerung und Bestenlisten erscheinen dort nicht. Die vorhandene
Quiz-State-Machine und ihre gespeicherten Werte bleiben unverändert.

### 2.2 Rendergruppe und Anatomietyp sind getrennt

Die aktuelle Bezeichnung `bones` beschreibt nur, aus welchem 3D-Asset eine
Struktur kommt bzw. wie sie angezeigt wird. Sie darf nicht länger automatisch
den fachlichen Typ `bone` bedeuten. Das Skelett-Asset enthält unter anderem
Knorpel, Zähne und Hohlraumstrukturen.

Künftig gelten getrennte Felder:

- `assetGroup`: `skeleton | soft_tissue`
- `renderGroup`: `bones | muscles | fasciae`
- `anatomicalType`: fachlicher Strukturtyp, z. B. `bone`, `cartilage`,
  `tooth`, `muscle`, `fascia`, `synovial_bursa`, `ligament`

### 2.3 Instanzdaten und Fachinhalte sind getrennt

Die 946 konkreten 3D-Objekte werden als Mesh-Instanzen geführt. Seitenneutrale
Fachinformationen werden auf ungefähr 496 anatomischen Konzepten gepflegt.
Linke und rechte Instanzen verweisen auf dasselbe Konzept; die Seitigkeit wird
erst in der Darstellung ergänzt.

Damit werden widersprüchliche Doppeltexte vermieden und Muskelteile können
über `parentConceptId` ihrem Gesamtmuskel zugeordnet werden.

### 2.4 Keine automatisch erfundenen Lerntexte

Die bisherigen Texte der Form „… ist im 3D-Modell selektierbar“ gelten nicht
als Lerninhalt. Ein fehlender Fakt bleibt als `needs_source` gesperrt, statt mit
einer plausibel klingenden Aussage gefüllt zu werden.

## 3. Datenarchitektur v2

```text
content/
  schemas/v2/
    catalog.schema.json
    instance.schema.json
    concept.schema.json
    source.schema.json
    review.schema.json
    release-state.schema.json
  v2/
    catalog.json
    instances.json
    sources.json
    taxonomy/
      regions.json
      anatomical-types.json
      relation-types.json
    concepts/
      stubs.json
      terminology.json
    curated/
      concepts.json
      sources.json
      release-states.json
    reviews/
      terminology.json
      anatomy.json
      localization.json
      classification.json
      mesh-mapping.json
    runtime-index.json
```

`content/structures.json` und `quizdata.json` bleiben während der Migration
generierte v1-Kompatibilitätsdateien. Der Asset-Importer darf kuratierte
Konzeptdateien niemals überschreiben.

### 3.1 Mesh-Instanz

Jede Instanz enthält mindestens:

```json
{
  "id": "Abdominal_part_of_pectoralis_major_muscle_L",
  "conceptId": "muscle.pectoralis_major.abdominal_part",
  "meshName": "(Abdominal part of pectoralis major muscle).l",
  "assetGroup": "soft_tissue",
  "renderGroup": "muscles",
  "side": "left",
  "availability": {
    "discover": true,
    "quizPolicy": "inherit"
  },
  "mapping": {
    "method": "exact_mesh_name",
    "status": "verified"
  }
}
```

Bestehende v1-IDs bleiben stabil, damit Quizfortschritt und Sammlungen nicht
verloren gehen. Die Laufzeit ordnet ausschließlich über den exakten originalen
GLTF-Namen in `userData.name` zu. Das fehleranfällige Substring-Matching wird
nach erfolgreichem 946/946-Abgleich entfernt.

### 3.2 Anatomisches Konzept

Ein Konzept umfasst:

- bevorzugten deutschen und lateinischen Namen sowie Aliase;
- Klassifikation und kontrollierte Körperregionen;
- kurze Zusammenfassung und einzelne Lern-Claims;
- typspezifische Details;
- gerichtete, kontrollierte Beziehungen zu anderen Konzepten;
- redaktionellen Zustand und Quellenreferenzen.

Typgerechte Details:

- Muskel: Ursprung, Ansatz, Aktion, Innervation, funktionelle Gruppe;
- Knochen/Skelettstruktur: Lage, Gelenkpartner, Landmarken, Ansätze, Rolle;
- Bindegewebe: Lage, Verbindungen/Kontinuitäten, Beziehungen, Inhalt und Rolle;
- Knorpel, Zahn, Bursa, Sehnenscheide, Band, Retinaculum und Aponeurose
  erhalten jeweils eigene Pflichtregeln.

Nicht anwendbare Felder werden als `not_applicable` geführt. Unvollständige
Felder werden als `partial` bzw. `needs_source` markiert, niemals erfunden.

### 3.3 Claims, Quellen und Reviews

Jede publizierte medizinische Aussage trägt mindestens eine passende Quelle
mit Fundstelle. Eine reine Terminologiequelle darf keine Funktion oder
Innervation belegen.

```json
{
  "claimId": "action.1",
  "textDe": "Quellengeprüfte Aussage.",
  "sourceRefs": [
    {
      "sourceId": "source.example",
      "locator": "Kapitel 4, Tabelle 12"
    }
  ],
  "evidenceStatus": "sourced"
}
```

Getrennte Reviewbereiche:

- `terminology`
- `classification`
- `anatomical_content`
- `localization`
- `mesh_mapping`

Autor und Reviewer müssen verschiedene IDs besitzen. Agentenprüfungen werden
als solche ausgewiesen; sie sind kein Ersatz für eine formale Freigabe durch
eine anatomisch qualifizierte Fachperson.

## 4. Quellenpolitik

Quellen werden pro zulässigem Einsatzzweck registriert:

- `terminology_only`
- `paraphrase_allowed`
- `citation_only`
- `public_domain`

Priorität:

1. [FIPAT Terminologia Anatomica 2, Version 2.07](https://libraries.dal.ca/Fipat/ta2.html),
   [Part II](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf)
   und die zugehörigen
   [Errata](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Errata.pdf)
   für normative Namen und IDs;
2. [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/)
   für FMA-basierte Struktur- und Teil-von-Beziehungen;
3. [German MeSH von ZB MED](https://www.zbmed.de/en/open-science/terminologies/german-mesh)
   für abgedeckte deutsche Fachbegriffe;
4. institutionelle, für die konkrete Wiederverwendung freigegebene Lehr- oder
   Referenzwerke für Lage, Funktion, Ursprung, Ansatz und Innervation;
5. die versionierten Z-Anatomy-Assets ausschließlich für Mesh-Identität,
   Geometrie, Kandidatenzuordnung und Upstream-Provenienz.

Die normativen FIPAT-Dateien werden per Prüfsumme gebunden:

```text
Part II  d30ce0d578b266ce4c47a6ff911e007a0cc440d65e9acaeb0680ec3eafa2231b
Errata   bdcd0aba0dc3eee636bed08859f0ceed8b86ef8985de85d9a5013fb11be3c776
```

Die TA2.csv des Z-Anatomy-Repositories ist nur ein Kandidatenindex. Sie enthält
synthetische Serien-IDs und teilweise ältere Begriffe. Nur ganzzahlige IDs, die
gegen TA2 2.07 und die Errata geprüft wurden, dürfen als offiziell gespeichert
werden. Serien wie einzelne Wirbel, Rippen, Zähne oder Phalangen erhalten eine
offizielle Basis-ID plus separaten Qualifier.

Der Vorabgleich zeigt, dass 936 der 946 Mesh-Instanzen normalisiert direkt in
der Z-Anatomy-Tabelle vorkommen und alle 946 plausibel gegen TA2 auflösbar sind.
Abweichungen werden als explizite Alias-, Errata- oder Mesh-Tippfehlerregeln
dokumentiert; es gibt keinen unsichtbaren Fuzzy-Fallback.

Nicht automatisch übernehmen:

- Z-Anatomy-Definitionen, da sie stark auf Wikipedia und automatischen
  Übersetzungen beruhen;
- Quellen mit Non-Commercial-, No-AI- oder Wiederverwendungsverbot;
- SNOMED CT, solange die konkrete Lizenzierung nicht geklärt ist;
- einzelne Lehrbuchtabellen ohne feldgenaue Lizenz- und Sachprüfung.

Texte werden eigenständig und knapp formuliert. Inhalte werden nicht aus
urheberrechtlich geschützten Quellen kopiert.

## 5. Arbeitsaufteilung

Die Arbeit erfolgt in fachlich getrennten Paketen, damit Dateien nicht
gleichzeitig überschrieben werden:

1. Bestand/Snapshot und Mesh-Zuordnung;
2. Skelettstrukturen nach Körperregion;
3. Muskeln nach Körperregion;
4. Bindegewebe nach Typ und Körperregion;
5. unabhängige Terminologieprüfung;
6. unabhängige Anatomieprüfung;
7. UI-Implementierung;
8. technische und visuelle Endabnahme.

Die Agentenschnittstelle unterstützt keine separate Modellwahl je Unteragent.
Qualität wird daher durch spezialisierte Rollen, getrennte Autor-/Reviewer-
Aufgaben, unterschiedliche Prüfprompts, Primärquellen und deterministische
Validatoren abgesichert.

## 6. Verbindliche Reihenfolge

### Phase A – Sicheres Fundament

1. Legacy-Snapshot für 946 Instanz-IDs, 739 Quiz-IDs, Asset-Hashes und
   Layerverteilung erzeugen.
2. v2-Schemas, kontrollierte Taxonomien und Quellenregister einführen.
3. `instances.json` exakt aus den GLBs ableiten und alte IDs erhalten.
4. Seitigkeits- und Konzeptgruppierung erzeugen; ungeklärte Fälle blockieren.
5. v2-Validator und Review-Gates implementieren.
6. v1-Kompatibilitätsprojektion reproduzieren, bevor die Laufzeit wechselt.

### Phase B – Inhalt

1. Terminologie und Mesh-Mapping für 946/946 Instanzen vervollständigen.
2. Zuerst alle fachlichen Typen im Skelett-Asset korrigieren.
3. Danach sämtliche 207 Bindegewebsstrukturen einzeln klassifizieren.
4. Lern-Claims regions- und typweise erstellen.
5. Jeden Arbeitsblock unabhängig prüfen und Abweichungen auflösen.

### Phase C – Entdecken-Modus

1. Catalog-Repository mit exakter Mesh-Auflösung einführen.
2. `experienceMode` und Standardzustand `explore` implementieren.
3. neues mobiles Stage-Layout, Suche und Filter umsetzen.
4. Auswahlkarte, Fokus, Isolation, Ansichten und Reset ergänzen.
5. Quiz über die bestehende kompatible Projektion anbinden.

### Phase D – Abnahme und Veröffentlichung

1. deterministische Inhalts- und Referenztests;
2. unabhängige fachliche Nachkontrolle;
3. mobile Browser-Tests, Touchgesten und Accessibility;
4. Performanceprüfung auf dem Produktions-Bundle;
5. Netlify-Preview;
6. Produktion erst nach bestandenem Freigabegate.

## 7. Qualitäts-Gates

Eine Produktionsfreigabe ist nur zulässig bei:

```text
946/946 Asset-Meshes exakt gemappt
0 mehrdeutige oder fehlende Mesh-Zuordnungen
0 unbelegte veröffentlichte medizinische Claims
0 Generator-Platzhalter im Lernmodus
0 nicht aufgelöste IDs, Quellen oder Beziehungen
0 unbestätigte Bindegewebsklassifikationen
0 ungeklärte Links-/Rechts-Konflikte
0 unerwartete Änderung am Quizpool
0 kritische Accessibility- oder Touchfehler
0 ungeklärte Browser- oder Buildfehler
```

Zusätzliche Stop-the-line-Fälle:

- `Iliocostalis colli muscle` und `.r` bleiben bis zur Quellenklärung
  `side: unresolved`;
- Rendergruppe darf nie wieder automatisch als anatomischer Typ validiert
  werden;
- sämtliche 207 Bindegewebsstrukturen werden einzeln, nicht nur als
  Stichprobe, geprüft;
- eine nicht belegte Aussage wird ausgeblendet statt veröffentlicht;
- ein fehlgeschlagener Snapshot-Diff blockiert die Migration.

## 8. Mobile UX- und Accessibility-Abnahme

Pflicht-Viewports: 320×568, 360×800, 390×844, 393×852 und 430×932.

Zu prüfen:

- alle primären Ziele mindestens 44×44 CSS-Pixel;
- Körper und Lernkarte werden durch Safe Areas nicht abgeschnitten;
- Ein-Finger-Drehung und Zwei-Finger-Pinch funktionieren gleichzeitig mit
  zuverlässiger Tap-Erkennung;
- Suche, Auswahl, Isolation und Reset sind per Tastatur erreichbar;
- Fokuszustände, Screenreader-Namen und Kontrast erfüllen WCAG 2.2 AA;
- `prefers-reduced-motion` entfernt nicht notwendige Bewegungen;
- kein Layoutsprung beim Nachladen der Detaildaten;
- kleine Strukturen lassen sich durch Smart-Fokus und Touch-Fallback sicher
  auswählen.

## 9. Performance-Grenzen

- mobile DPR bleibt adaptiv begrenzt;
- Detail-Chunks werden erst bei Auswahl geladen und gecacht;
- Suchindex und Mesh-Mapping werden beim Start geladen;
- keine zusätzlichen Draw Calls allein für dauerhaft unsichtbare UI-Zustände;
- Auswahlkontur und Kontext-Dimming werden auf realen Mobilprofilen geprüft;
- Bundle- und Assetgrößen werden im Build-Manifest protokolliert.

## 10. Freigabestatus

Die Umsetzung kann technisch vollständig und agentengeprüft werden. Eine
behauptete medizinische Fehlerfreiheit ist jedoch erst nach dokumentierter
Fachfreigabe vertretbar. Bis dahin bleibt der entsprechende Inhalt sichtbar
als `agent_reviewed` oder wird bei offenen Belegen gar nicht publiziert.
