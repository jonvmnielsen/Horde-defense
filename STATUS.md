# Status

_Senest opdateret: 2026-10-08_

## Nu
Runde 10 (9. okt): belønninger samles op, nedtælling på alt man skyder på, tættere horde med større specialfjender, nye lyde.

- **Belønninger samles op:** kasser (+2, +8, +60), våbenkister, 2× skud, bomber og ×2-porten kommer imod truppen og fanges, hvis truppen står hvor de ankommer. Man skyder ikke længere på dem.
- **Skal stadig skydes:** fanger (helte) og mure. En mur der når truppen i dens spor knuser 18+ soldater; muren foran +60 har nu 900 liv (før 2200).
- **Nedtælling:** tal + bjælke over mure, fanger, kampesten, skeletmagikere, guldkrigere og bossen. Rødt og pulserende under 30 %. Mure kaster stenflis når de rammes.
- **Horden:** rækkerne står skulder ved skulder (rækkeafstand 0,8, ikke 1,0), massen slingrer lidt i sporet. Krigere 1,35×, Kæmper 1,95×, Guldkrigere 2,5×, magikere 2,2×, boss 3,8× størrelse. Basisskelettet 0,92×.
- **Ingen tekst om fjender:** STORMLØB, SKELETMAGIKER, BOSS og ×2 PORT vises ikke længere; lyd (krigstrommer, brøl) og forandringen i massen fortæller det.
- **Lyde:** 43 nye lyde renderet fra fysiske opskrifter (armbrøststreng, knogler der rammes og falder sammen, rustning, råb, eksplosioner, sten, krigshorn, trommer, boss-brøl) + en løkke med hordens fødder og stønnen, der bliver højere jo tættere horden er. Lyden placeres venstre/højre efter hvor det sker. `tools/make-sounds.py`.
- **Start:** 16 soldater (før 12); horden starter lidt langsommere (2,9).
- **Rettet fejl:** ×2-porten gav ingen soldater i runde 8-9.
- **Bot-test:** bane 1 vinder 8/8 (aktiv og forsigtig), kun-midten taber. Bane 2 (34 soldater) 3/4. Bane 3 uden base-opgraderinger 1/3.

## Udgivelse
- Live på https://jonvmnielsen.github.io/Horde-defense/ (GitHub Pages, udgives automatisk ved push til `main`).

## Næste
1. Jon tester opsamling, nedtælling og lyde.
2. Jon henter de pakker i `docs/ASSETS.md`, der skal med.
2. Tema: soldater mod zombier, når Jon har lagt Quaternius-pakkerne (Toon Shooter, Zombies, Animated Women) i repoet.
3. Kvindelige helte (snigskytte, læge, sprængstofekspert) i bure, når Jon har svaret på forslaget.
