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
| 2026-10-07 | Bredere spor (6), truppen længere frem, kamera tættere og følger truppen | Jon: soldater forsvandt i bunden, for meget af skærmen stod passivt. |
| 2026-10-07 | Armbrøst-rækkevidde 32 enheder | Fjender og genstande døde ude ved horisonten; nu sker kampen på skærmen. |
| 2026-10-07 | Sidesporene får tilfældige hændelser fra hver sin bunke | "Samme fordele i hver side" var for nemt; hver side skal kræve et valg. |
| 2026-10-07 | Våbenopgraderinger i 5 trin fra kister i sidesporene, nulstilles hver bane | Jon: det skal være nødvendigt at få både flere soldater og bedre våben. Permanente opgraderinger hører til basen senere. |
| 2026-10-07 | Højst 110 soldater tegnes (før 150) | Truppen skal kunne være på en telefonskærm. |
| 2026-10-07 | Mange svage fjender i stedet for få seje | Referencen viser en horde der fylder sporet; ét skud pr. skelet i starten. |
| 2026-10-07 | Lav-poly skelet (meshoptimizer, 36 %) og ingen rigtige skygger på horden | Op til ~1.200 skeletter på skærmen skal kunne køre på en telefon. |
| 2026-10-07 | Soldater skyder altid; tomme skud lander i jorden ved max rækkevidde | Jon: ilden skal være konstant, også i tomme spor. |
| 2026-10-07 | Ingen udglatning på styringen | Jon oplevede forsinkelse; truppen følger nu fingeren direkte. |
| 2026-10-07 | Helte befries fra stenfanger; stenen brydes i 10 trin | Jons idé om gradvist færre sten, lavet i 3D med klippestykker i stedet for stillbilleder. |
| 2026-10-08 | Horden spawner som rækker i fast tempo i stedet for enkeltvis | Jon: kolonnen skal være én masse som i reklamerne. |
| 2026-10-08 | Gennemboring af overskydende skade | Svage skeletter i tusindvis gjorde våbenopgraderinger værdiløse; nu tæller både antal og våben. |
| 2026-10-08 | Instruktør der skalerer skeletternes liv efter truppens ildkraft | Belønningerne gav en lavine, så horden ikke længere pressede. Nu er der altid tryk på; trykket stiger gennem banen. |
| 2026-10-08 | Sidesporene fyldes uden pauser og er fulde fra start | Jon: der skal hele tiden være noget på vej i alle kolonner. |
| 2026-10-08 | Instruktøren (skalering efter spillerens styrke) er fjernet | Jon: med mange soldater og gode våben blev det umuligt. Belønninger skal kunne mærkes. |
| 2026-10-08 | Faste fjendetyper + hændelser giver presset | Jon: normal horde med fast styrke, plus stærkere specielle fjender, bosser og fjendtlige helte. |
| 2026-10-08 | Belønningsbudget pr. bane | Uden loft gav fæstninger og våbenkister en lavine; budgettet gør valgene vigtige. |
| 2026-10-08 | Skifte i skudhastighed bevarer hver soldats fase | 2× skud gav salver; Jon vil have kontinuerlig ild. |
| 2026-10-08 | Ingen mure mellem sporene, sporbredde 7,5 | Jon: bredere kolonner, murene skal væk. |
| 2026-10-08 | Farer der ruller ind i lejren | Jon: forhindringer skal kunne dræbe truppen, hvis man ikke flytter sig. |
| 2026-10-08 | Offerporte og eskorterede belønninger | Jon: belønninger skal være svære, og man skal nogle gange ofre soldater. |
