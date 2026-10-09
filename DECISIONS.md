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
| 2026-10-08 | Offerporten tages ud af spillet (koden bliver) | Jon mente "ofre" som prisen ved at skyde i et belønningsspor, mens horden kommer nærmere. Kan komme tilbage senere. |
| 2026-10-08 | ×2-porte kører inde i horden | Jon: multiplikator midt i horden; man skal skyde sig igennem massen for at nå den. Loft på gevinsten, så den ikke giver lavine. |
| 2026-10-08 | Tre heltetyper med hver sin evne | Jon: heltevalg med ild, frost der bremser, og helbredelse. |
| 2026-10-08 | Bossen kaster sten med varselsring | Jon: noget man skal undvige. Undvigelse koster ild på bossen (man skifter spor). |
| 2026-10-08 | Base med Kaserne, Våbensmed og Heltehal; guld fra alle baner, overlevende fra vundne | Jon: overlevende skal betyde noget, guld skal købe startsoldater, våben og helte. Kasernens loft holder næste bane fra at blive triviel. |
| 2026-10-08 | Banekort med 3 stjerner efter overlevende | Jon: kort med stjerner. Stjerner belønner at holde truppen i live. |
| 2026-10-08 | Det basale skelet har 1 liv også på bane 2 | Bot-test: bane 2 tabte 2 af 3, fordi armbrøsten skulle bruge 2 skud pr. skelet. |
| 2026-10-08 | Opløsning 2× på telefoner, mindre bloom og dis | Jon: billedet var sløret og "røget". |
| 2026-10-08 | Begivenhedstekst øverst, ingen svævende tal ved gevinst og tab | Jon: tekst midt på skærmen skjulte sporene. Analysen: kun tal på porte og over truppen. |
| 2026-10-08 | Syntetiseret lyd (WebAudio) i stedet for lydfiler | Ingen licenser at tjekke, intet at downloade, lille fil. Lyd var det største hul ifølge analysen. |
| 2026-10-08 | Tælleren over truppen er al feedback på antal | Gevinst og tab vises ét sted, hvor øjet allerede er. |
| 2026-10-08 | Base med 10 opgraderinger og stigende priser; guld fra resultat i stedet for drab | Jon havde alt efter 2-3 baner; drab gav ~3000 guld pr. bane. |
| 2026-10-08 | Nye asset-pakker fra tredjeparts kopier bruges ikke uden Jons OK | Licensen skal kunne læses i kildens egen fil (CLAUDE.md). |
| 2026-10-09 | Belønninger samles op ved at stå hvor de ankommer | Jon: man skal ikke skyde på alt. Valget er nu: forlad midten for at fange, mens horden rykker nærmere. |
| 2026-10-09 | Mure ruller videre og knuser truppen i deres spor | Jon: mure skal skydes i stykker for ikke at blive mast. |
| 2026-10-09 | Nedtælling (tal + bjælke) over alt man skal skyde ned | Jon: man skal kunne se hvor meget der mangler. |
| 2026-10-09 | Tæt pakket horde; specialfjender markant større | Jon: massen var ikke tæt nok, og særlige fjender skal kunne ses på størrelsen. |
| 2026-10-09 | Ingen bannertekst om fjender | Jon: forandringen i massen skal fortælle hvad der sker. |
| 2026-10-09 | Lyde renderes fra fysiske opskrifter (numpy) i stedet for live-synth | Jon: de første lyde var klik. Optagede lyde kræver pakker der ikke kan hentes herfra; renderede lyde har ingen licens at tjekke. |
| 2026-10-09 | Opsamlede kasser giver +2 / +8 / +60 | Man skal være der for at få dem, så de må være mere værd. |
| 2026-10-09 | Sidesporene kommer i par, der ankommer samtidig | Jon: man kunne samle det hele; nu er der et rigtigt valg. |
| 2026-10-09 | Talporte der kan skydes op | Reklamens kerne; giver mening at skyde i sidesporet. |
| 2026-10-09 | Store belønninger bag mure begraves hvis muren ikke brydes | Jon: risikoen for at det går galt og man har spildt en masse skal være der. |
| 2026-10-09 | Stormløb når en stor belønning ankommer | Planlagt næsten-tab. |
| 2026-10-09 | Bredere spor og tættere trup | Jon: for kort afstand mellem banerne. |
| 2026-10-09 | Baner på 45 s + 8 s pr. bane | Analysen: korte runder i starten. |
| 2026-10-09 | Lyd: dybt, blødt, lavpasfiltreret; salver som lydløkker der følger ildkraften | Jon: lydene var klingende og skingre; intensiteten skal kunne høres. |
| 2026-10-09 | Endeløs tilstand bruger hele reserven | Designdokumentet: endeløs med dødsdømt trup trænet i basen. |
| 2026-10-09 | Basen som 3D-landsby (Medieval Hexagon) | Jon: basen skal være visuel med bygninger der ændrer sig. |
| 2026-10-09 | Ny fanebærer og heltinder venter på pakker | Kræver figurer vi ikke har lov til at hente herfra. |
