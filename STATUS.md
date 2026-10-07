# Status

_Senest opdateret: 2026-10-07_

## Nu
Runde 4 efter Jons tredje test: masser af fjender, konstant ild, øjeblikkelig styring, helte.

- **Horde:** midtersporet fyldes (6 → 26 fjender i sekundet gennem banen, stormløb på 50-110). Skeletterne er svage enkeltvis (lav-poly model, ~1.900 trekanter) og kaster kun kontaktskygger, så ydelsen holder.
- **Konstant ild:** alle soldater skyder i hver armbrøst-cyklus; uden mål flyver bolten til max rækkevidde og slår ned i jorden.
- **Styring:** truppen følger fingeren 1:1 uden udglatning; opløsning max 1,5× med hurtigere automatisk nedskalering.
- **Helte:** "BEFRI HELT"-fanger i sidesporene: en magiker frosset i sten, klippestykker falder af i 10 trin når man skyder. Befriet helt står foran truppen og kaster ildkugler med område-skade (max 3).
- **Større valg:** "VÅBEN ++" (to våbentrin på én gang, bag en tyk mur), fæstning (+99), fanger, almindelige våbenkister, 2× skud, bomber, fjende-grupper på 15-45.
- **Bot-test:** kun midten taber efter ~30 s; en aktiv spiller vinder bane 1 og 2 (~1.600-2.000 drab pr. bane).

## Udgivelse
- Live på https://jonvmnielsen.github.io/Horde-defense/ (GitHub Pages, udgives automatisk ved push til `main`).

## Næste
1. Jon tester runde 3 på telefon.
2. Beslut om banerne skal have en slutning (fast antal pr. kapitel) eller fortsætte uendeligt.
3. Beslut tema (fantasy som nu, eller moderne militær med andre modeller).
