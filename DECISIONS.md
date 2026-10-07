# Beslutninger

| Dato | Beslutning | Hvorfor |
| --- | --- | --- |
| 2026-10-07 | Three.js (web) frem for Godot til prototypen | Hver version kan spilles på mobil med det samme; Godots web-eksport er tung på mobil. Motoren kan genovervejes, når kernen sidder. |
| 2026-10-07 | Projektet ligger på GitHub fra dag ét | Arbejdet må ikke være låst til én maskine; Jon bygger også fra mobilen. |
| 2026-10-07 | Kun rigtige 3D-modeller, aldrig figurer af grundformer | Tidligere projekter med kode-genereret geometri så forkerte ud; finish er et krav fra start. |
| 2026-10-07 | KayKit-pakker (CC0) til den visuelle test | Kunne hentes fra GitHub i arbejdsmiljøet; licens verificeret i pakkernes LICENSE-filer. Giver fantasy-tema (skytter mod skeletter). |
| 2026-10-07 | Animationer bages til teksturer (VAT) og tegnes instanced | Hundredvis af animerede figurer med ét draw call pr. figurtype; nødvendigt for ydelse på mobil. |
| 2026-10-07 | Udgivelse via GitHub Pages | Claudes artifact-visning afviser Jons telefon; Pages er en almindelig hjemmeside. |
| 2026-10-07 | Modeller udgives som glTF-JSON i stedet for .glb | Artifacts serverer ikke .glb; JSON virker begge steder. |
