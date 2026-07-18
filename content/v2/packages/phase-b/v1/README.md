# Phase-B-Pakete v1

Die 17 JSON-Manifeste in diesem Verzeichnis frieren die Arbeitsabdeckung für
alle 496 meshgebundenen Konzepte und 946 Instanzen ein. Ihre Zuordnung beruht
auf den vorhandenen Assetlabels; sie ist keine medizinische Regions- oder
Typfreigabe. Medizinische Inhalte werden ausschließlich als atomare,
quellengebundene Claims in der Kurationsschicht erfasst.

## Reihenfolge

1. Zuerst werden die vier zentralen Stop-the-line-Fälle untersucht. Sie bleiben
   für `published` und `source_verified_mvp` technisch gesperrt, bis die jeweils
   dokumentierten Identitäts-, Terminologie-, Seitigkeits- oder
   Geometriefragen aufgelöst sind.
2. Danach folgen alle vier Bindegewebspakete, beginnend mit Faszien,
   Faszienbögen, Septa und Faszienzug.
3. Anschließend werden Muskel- und Skelettpakete bearbeitet. Claims eines
   Elternmuskels oder einer Sammelstruktur dürfen nicht ungeprüft auf Köpfe,
   Bäuche, Teile oder Einzelinstanzen übertragen werden.

## Quellenbindung pro Konzept

Ein Manifest allein schaltet keinen Lerninhalt frei. Für jedes Konzept sind
getrennt erforderlich:

- ein vollständiger Release-State für Typ, Region, jede Seitigkeit und jedes
  exakte Mesh;
- ein Namensblock mit dem exakten gepinnten FIPAT-TA2-Latein und einem
  feldgenau belegten deutschen Namen;
- eine quellengebundene Zusammenfassung und alle Pflichtfelder des
  strukturtypspezifischen Vollständigkeitsprofils;
- registrierte, unveränderlich gehashte Quellen mit zulässigen Rechten und
  quellenspezifischen strukturierten Locators;
- voneinander getrennte Autor- und Review-Identitäten sowie aktuelle,
  target-hashgebundene Reviews für die gewählte Verifikationsstufe;
- vollständige Schema-, Quellen-, Abdeckungs-, Runtime-, UI-, Performance- und
  Buildtests.

`published` bleibt ausschließlich humanmedizinisch fachgeprüft.
`source_verified_mvp` bezeichnet nur den nichtmedizinischen, quellengebundenen
MVP-Pfad mit expliziten Agentrollen und sichtbarem Nutzungshinweis. Beide Pfade
sind fail-closed.

## Snapshot-Workflow

Registrierte Snapshot-Locks können mit `npm run content:sources:list`
aufgelistet werden. Die tatsächlichen Bytes werden vor ihrer Verwendung mit
`npm run content:sources:verify -- source.id=/pfad/zum/snapshot` gegen Größe
und SHA-256 geprüft. Registrierung oder erfolgreicher Hashabgleich allein
belegen noch keinen anatomischen Claim; jeder Claim benötigt zusätzlich eine
präzise Fundstelle und den passenden Review.

Die vier Stopfälle und ihre Auflösungskriterien werden in
`docs/phase-b-stop-cases-2026-07-15.md` fortgeschrieben.
