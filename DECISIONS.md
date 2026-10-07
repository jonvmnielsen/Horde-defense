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
| 2026-10-07 | Ubegrænset trup, men højst 150 soldater vises; hver vist soldat skyder med vægten antal/viste | Tælleren må ikke stoppe (før: 416). Holder ydelsen på mobil. Midlertidigt: alternativet er et hårdt loft + bedre våben, besluttes senere. |
| 2026-10-07 | Ét skud pr. armbrøst-animation, udløst i takt med animationen | Skydningen så tilfældig ud; nu matcher hvert skud en synlig bevægelse. |
| 2026-10-07 | Baner med fast længde, fremskridtsbjælke og boss til sidst | Spilleren skal kunne se, hvor langt der er igen. |
| 2026-10-07 | Hver bane starter med en frisk trup (12 + 8 pr. bane); overlevende "går hjem" | Overførte tropper gjorde næste bane triviel. Overlevende får betydning, når basen bygges. |
| 2026-10-07 | Balance justeres med bot-simulering (`tools/sim.py`) | Hurtig, gentagelig måling i stedet for gætværk; mål: ét-spors-spil taber, spor-skift vinder. |
| 2026-10-07 | Lys fra siden og svagere himmellys | Skygger faldt bag figurerne og blev overdøvet af fyldlys. |
