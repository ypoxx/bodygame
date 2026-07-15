# AnatomyQuest – Phase-B-Inhalts- und Reviewplan

Stand: 2026-07-15
Geltungsbereich: 496 meshgebundene Konzepte / 946 auswählbare Instanzen

## 1. Freigabeprinzip

Die Anwendung darf nur Lerninhalte anzeigen, die aus der geprüften
Runtime-Projektion stammen. Ein Text in einer Arbeits- oder Kurationsdatei ist
noch kein veröffentlichter Lerninhalt.

Ein Konzept darf `published` werden, wenn:

1. der deutsche und lateinische Namensblock feldgenau belegt ist;
2. jede atomare anatomische Aussage eine registrierte Quelle mit stabiler
   Fundstelle besitzt;
3. der Hash des Namensblocks von einer unabhängigen Fachperson für
   Lokalisation akzeptiert wurde;
4. der Hash jedes Claims von einer unabhängigen medizinischen Fachperson
   akzeptiert wurde;
5. Terminologie, Klassifikation, Seitigkeit und Mesh-Zuordnung nicht gesperrt
   sind;
6. der Generator ausschließlich freigegebene Felder in die Runtime übernimmt.

Agenten und Automatisierung dürfen recherchieren, extrahieren, Entwürfe
erstellen und Konsistenz prüfen. Sie ersetzen keine medizinische oder
lokalisierende Publikationsfreigabe.

## 2. Ausgangsbestand

| Bereich | Konzepte | Instanzen |
| --- | ---: | ---: |
| Skelettasset | 159 | 277 |
| Muskeln | 232 | 462 |
| Bindegewebe | 105 | 207 |
| **Gesamt** | **496** | **946** |

Der Bestand ist meshvollständig, aber fachlich noch nicht vollständig:

- 0 publizierte deutsche Fachnamen;
- 0 publizierte Zusammenfassungen oder anatomische Detailclaims;
- 0 kuratierte anatomische Release-States;
- 496/496 Konzepte mit ungeklärter Region;
- 496/496 Strukturtypen nur maschinell aus dem Assetlabel abgeleitet;
- 449 reguläre Links-/Rechts-Paare, 46 mittige Einzelstrukturen und ein
  Konzept mit ungeklärter Seitigkeit;
- 495 Konzepte mit offiziellem TA2-Basisbegriff und eine abgeleitete
  Modellstruktur.

Die 946 Meshes bilden den Umfang der vorliegenden Assets vollständig ab. Das
ist ausdrücklich kein Nachweis, dass die Assets die gesamte menschliche
Anatomie vollständig enthalten.

## 3. Stop-the-line-Register

Diese Konzepte dürfen bis zur dokumentierten Auflösung keine Lernprojektion
erhalten:

| Konzept | Grund | Erforderliche Auflösung |
| --- | --- | --- |
| `concept.soft_tissue.iliopsoas_fascia` | auffällige Links-/Rechts-Geometrie | Abgleich mit autoritativer Referenz, dokumentierte Assetentscheidung |
| `concept.soft_tissue.tendon_of_extensor_digitorum_longus` | abgeleitete Struktur ohne eigenen TA2-Eintrag | fachliche Identitäts- und Benennungsentscheidung |
| `concept.soft_tissue.trochanteric_bursa_of_gluteus_medius_muscle` | singuläres Mesh gegenüber pluralem TA2-Begriff | Terminologie- und Geometrieprüfung |
| `concept.soft_tissue.iliocostalis_colli_muscle` | zwei Instanzen mit ungeklärter Seitigkeit | Links-/Rechts-Zuordnung am Modell prüfen |

Vor einer Null-Fehler-Aussage zusätzlich manuell zu prüfen:

- `Anterior intermuscular septum of leg`: Triangle-Soup-Geometrie;
- `Calcaneal tendon`: ein degeneriertes Dreieck je gemeinsam genutztem
  Mobile-LOD-Mesh;
- offene Ränder bei 166/207 Bindegewebsinstanzen, darunter 76/78 Bursen; nicht
  automatisch schließen oder solidifizieren;
- 104 priorisierte Terminologieentscheidungen: 90 Serienvarianten,
  12 Aliaszuordnungen, ein Mesh-Tippfehler und eine abgeleitete Struktur.

## 4. Registrierte und geplante Quellenrollen

Aktuell sind fünf Quellen registriert: zwei Assetquellen, zwei FIPAT-Teile und
German MeSH. Keine davon unterstützt `anatomical_claims`; medizinische Claims
können deshalb gegenwärtig nicht publiziert werden. BodyParts3D, Oregon State,
Virginia Tech und der Faszienkonsens sind geprüfte Kandidaten, müssen aber vor
Verwendung jeweils als exakter Snapshot mit Rechten und Prüfsumme registriert
werden.

| Quelle | Rolle | Nicht zulässig |
| --- | --- | --- |
| FIPAT TA2 2.07 | normative lateinische/englische Terminologie, TA2-ID | Funktions- oder Lageclaims daraus ableiten |
| Deutscher MeSH, versionierter Snapshot | exakte deutsche Deskriptoren und Synonyme | fehlende TA2-Feingranularität algorithmisch ergänzen |
| BodyParts3D, exakt gepinnter aktueller Archivstand | Kandidaten für FMA-/Regions-Crosswalk und Geometrieprovenienz | alleinige medizinische Lehrevidenz |
| Oregon State A&P, exakt lokalisierte offene Tabellen | quellengenau paraphrasierte Muskelclaims | pauschale Vererbung auf Muskelteile oder Serienvarianten |
| Virginia Tech *Applied Human Anatomy* | unabhängige Sekundärkontrolle ausgewählter Aussagen | alleinige Vollständigkeitsquelle |
| Faszien-Nomenklaturkonsens 2019 | allgemeine Typdefinition für Faszie/fasziales System | individuelle Kontinuitäten oder Kraftübertragung ableiten |

OpenStax A&P 2e, StatPearls/UAMS und Quellen mit Non-Commercial-, No-AI-,
No-Derivatives- oder ungeklärten Wiederverwendungsbedingungen werden nicht in
die automatisierte Inhalts-Pipeline aufgenommen.

Aktuell registrierter Lokalisierungs-Snapshot:

| Datensatz | Version | SHA-256 | Erlaubter Umfang |
| --- | --- | --- | --- |
| German MeSH, bilinguale CSV | 30.0, Dezember 2025 | `90e2dba833aeae49a05508e24dad974c7c8264c9179427d8a7650beae6028f04` | ausschließlich `PreferredLabelDE` und `SynonymsDE` unter CC BY 4.0; englische Spalten bleiben unter den separaten NLM-Bedingungen außerhalb dieses Source-Eintrags |

Der Snapshot enthält 26.673.430 Bytes und wird über DOI
`10.4126/FRL01-006526467` identifiziert. Seine Registrierung veröffentlicht
noch keinen deutschen Namen. Jede Zuordnung zu einem TA2-Konzept benötigt
weiterhin einen exakten `DescriptorUI`-Locator und einen unabhängigen,
hashgebundenen Lokalisierungsreview.

Technisch ist dieser Locator als Objekt gebunden, zum Beispiel
`{"kind":"mesh_descriptor","descriptorUi":"D000001"}`. Freitext wie
`DescriptorUI:D000001` wird vom Publikationsgate abgelehnt.

Die verifizierte CSV lag für die Prüfung lokal unter `/tmp`; sie wird nicht in
Git versioniert und von einem sauberen Build nicht automatisch heruntergeladen.
Vor produktiver Kurationsarbeit braucht sie daher einen reproduzierbaren,
lizenzkonformen Fetch-und-Hash-Schritt oder ein dokumentiertes internes
Snapshot-Artefakt.

Jeder Snapshot benötigt Version, Abrufdatum, Lizenzstatus und SHA-256. Jeder
Claim benötigt einen eigenen Locator. Mehrteilige Aussagen werden in atomare
Claims geteilt.

## 5. Inhaltspakete

Die folgenden Zahlen sind vorläufige Arbeitsbündel nach Assetlabel, noch keine
gespeicherten Regionsklassifikationen. Vor Beginn eines Pakets wird ein
versioniertes Concept-ID-Manifest erstellt; erst dadurch wird seine Abdeckung
reproduzierbar.

### Skelett – 159 Konzepte

1. Kopf/Hals – 44
2. Wirbelsäule – 26
3. Thorax – 25
4. obere Extremität – 32
5. Becken/untere Extremität – 32

### Muskeln – 232 Konzepte

1. Kopf, Orbita, Gesicht, Zunge – 36
2. Hals, Pharynx, Larynx – 30
3. Rücken – 35
4. Thorax, Abdomen, Beckenboden – 24
5. Schulter/Oberarm – 15
6. Unterarm/Hand – 36
7. Hüfte/Oberschenkel – 27
8. Unterschenkel/Fuß – 29

47 Konzepte sind Köpfe, Teile oder Bäuche von 22 übergeordneten Muskeln. Die
22 Elternkonzepte sind noch nicht im meshgebundenen Katalog repräsentiert.
Hierfür wird eine separate, nicht auswählbare Aggregat-/Hierarchieebene
benötigt; ein Elterntext darf nicht ungeprüft auf seine Teile vererbt werden.
`parentConceptId` ist im aktuellen Katalog deshalb noch bei allen Konzepten
leer.

14 Muskelkonzepte sind Sammelstrukturen im Plural und müssen als Gruppen statt
als Einzelmuskel beschrieben werden.

### Bindegewebe – 105 Konzepte

1. Faszien, Faszienbögen, Septa und Faszienzug – 31
2. obere Extremität: Bursen und Sehnenscheiden – 15
3. untere Extremität: Bursen und Sehnenscheiden – 37
4. Retinacula, Sehnen, Bänder, Aponeurosen und Sondertypen – 22

Alle 105 Konzepte werden einzeln bearbeitet. Name oder räumliche Mesh-Nähe
dürfen niemals als Beleg für Ansatz, Inhalt, Kontinuität oder Funktion dienen.

## 6. Arbeitsfluss pro Paket

1. Quellen-Snapshots registrieren und lizenzrechtlich freigeben.
2. Meshliste, Konzeptgrenzen, Seitigkeit, Typ und Region vorab prüfen. Das
   Ergebnis wird getrennt in `curated/release-states.json` gespeichert;
   Generatorfelder bleiben unveränderbar.
3. Namensblock erstellen; FIPAT und deutsche Quelle getrennt zitieren.
4. Typgerechte, atomare Claims mit exakten Fundstellen entwerfen.
5. Automatische Prüfungen ausführen: Schema, IDs, Quellenfähigkeiten,
   Locator, Hashes, Terminologiegleichheit, Meshabdeckung und Dubletten.
6. Unabhängige Lokalisierungsprüfung des Namensblocks.
7. Unabhängige medizinische Prüfung jedes Claims.
8. Separate unabhängige Reviews für Klassifikation, Region, Lateralisierung
   und Mesh-Mapping akzeptieren. Das Mesh-Mapping benötigt eine menschliche
   Asset-Fachrolle; die übrigen drei Bereiche eine medizinische Fachrolle.
9. Änderungen nach Review einarbeiten; dadurch ungültige Hashes erneut prüfen.
10. Nur akzeptierte Konzepte in die Runtime projizieren.
11. Paketbezogene Mobile-QA: Suche, Auswahl, Pinch-Zoom, Fokus, Isolation,
    Vorder-/Rückseite, Lernkarte und Screenreader-Bezeichnungen.

Autoren- und Reviewer-IDs müssen verschieden sein. Ein `agent_reviewed`-Status
ist nachvollziehbare Vorprüfung, aber keine Publikationsfreigabe.

## 7. Abschlusskriterien

Ein Paket ist erst abgeschlossen, wenn:

- alle vorgesehenen meshgebundenen Konzepte entweder publiziert oder mit
  explizitem Blockgrund dokumentiert sind;
- es keine ungeklärten Quellen-, ID-, Seiten-, Typ- oder Regionsreferenzen
  gibt;
- jeder veröffentlichte Namensblock und Claim einen aktuellen akzeptierten
  Human-Review-Hash besitzt;
- der vollständige Release-State je Konzept alle Instanzen in kanonischer
  Reihenfolge abdeckt und aktuelle Human-Review-Hashes für Klassifikation,
  Region, Lateralisierung und Mesh-Mapping enthält;
- die 946/496-Abdeckung und der bestehende Quizpool unverändert bleiben;
- technische, fachliche und Mobile-QA durch voneinander getrennte Rollen
  bestanden wurden.

Für die Gesamtproduktion gelten zusätzlich null offene Stop-the-line-Fälle und
ein bewusstes Produktvotum, ob nicht im Asset vorhandene anatomische
Strukturen ergänzt oder als dokumentierte Scope-Grenze ausgewiesen werden.
