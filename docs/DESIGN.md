# Designdokument: Horde-forsvarsspil

7. oktober 2026 · Jon

## Vision

Et 3D-mobilspil hvor man forsvarer sig mod enorme horder med en trup soldater, der vokser undervejs. Spillet bygger det, mobilreklamerne for spil som Last War og Top War lover, men sjældent leverer.

- **To dele:** kampdelen ("tower defense") og basebygning. Vi starter med kampdelen.
- **Stil:** 3D som i reklamerne: stiliserede figurer, krigsramt by, klare farver pr. side (blå spiller, rød fjende, gul bonus).
- **Følelsen:** hundredvis af enheder på skærmen, store tal, konstante valg under pres.
- **Platform:** mobil. Motor foreslået: Godot 4 (endnu ikke besluttet).

## Besluttet: kampdelen

Man står stille i bunden af banen og bevæger kun truppen fra side til side; alt andet kommer imod én.

- **Styring:** træk sidelæns. Truppen skyder automatisk fremad.
- **Baner:** flere spor side om side. Hvert spor kan rumme fjender, bonusser, mure eller andet.
- **Skydning:** et skud rammer det første i sit spor. Placeringen er den vigtigste taktiske beslutning.
- **Trup med bredde:** hver soldat skyder i det spor, den selv står i. Står truppen mellem to spor, deles ilden efter hvor mange soldater der står over hvert spor. En større trup er bredere og kan dække flere spor. *(Forslag, ikke endeligt bekræftet.)*
- **Skade på truppen:** hver fjende, der når frem, koster soldater.
- **Designprincip:** hver ny ting på banen skal gøre valget af spor sværere eller mere interessant.
- **Sværhedsgrad:** stiger løbende, især gennem nye fjendetyper.

## Økonomi og progression

Guld er den eneste valuta i første version, og kernen er loopet: træn trup i basen → send den ud → tjen guld → køb mere og bedre trup → gentag.

**Regler for truppen**

- Almindelige soldater, man samler op på banen, kommer med hjem, hvis de overlever.
- Helte man møder undervejs skal hverves (købes) efter kampen, og kun hvis de overlever.
- Stærke våben skal også hverves eller købes.
- Basen skal give meget mere end bare at træne tropper, så den ikke bliver overflødig af soldaterne fra banerne.

**Spiltyper**

| Spiltype | Mål | Hvad man får | Truppen |
| --- | --- | --- | --- |
| Almindelig level | Klare bølger og en boss | Guld | Overlevende kommer med hjem |
| Endless | Holde ud så længe som muligt | Mere guld jo længere man holder | Dødsdømt fra start; man vælger hvor meget man ofrer |
| Exploration *(senere)* | Udforske | Ting, penge og ressourcer til at genopbygge basen | Ikke afklaret |
| Defense *(senere)* | Forsvare | Færre ressourcer, men flere penge og specielle genstande | Ikke afklaret |

**Prototype:** basen er en simpel menuskærm, hvor man bruger guld på start-trop, skudhastighed og skade.

## Idébank

Alt herunder er idéer, ikke beslutninger; listen vokser løbende.

| Kategori | Idéer |
| --- | --- |
| Trop | +N, ×N, minus-porte, fanger man kan befri |
| Våben | Skudhastighed, skade, spredning, gennemboring |
| Specialvåben | Bomber (AOE), flammekaster, laser, luftangreb |
| Strukturer | Mure med liv der spærrer for belønninger (som 600-muren foran +99), tårne der slutter sig til én |
| Helte | Mødes på banen, har en unik evne, hverves efter kampen |
| Events | Bosser, forsyningsdrop, stormløb, større events |
| Fjender | Sværm, tank, hurtigløber, skjoldbærer (blokerer forfra), splitter (deler sig når den dør), skytte (dræber soldater på afstand) |
| Base | Opgraderinger, bygninger, helte-rekruttering, træning af start-trop; senere angreb på basen |

## Åbne spørgsmål

- [ ] Spillets navn
- [ ] Motor: Godot 4 eller Unity?
- [ ] Bekræft reglen om truppens bredde og delt ild mellem to spor
- [ ] Hvor mange spor har en bane? Fast antal, eller varierer det pr. level?
- [ ] Hvordan er en level bygget op: antal bølger, boss, længde i minutter?
- [ ] Hvordan tjenes guld i kampen: pr. drab, pr. bølge, ved at overleve?
- [ ] Hvad koster det at hverve helte og våben, og hvordan balanceres det mod basen?
- [ ] Hvad giver basen ud over træning af tropper?
- [ ] Afhænger exploration/defense af level, eller vælger man selv?
