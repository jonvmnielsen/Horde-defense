# Status

_Senest opdateret: 2026-10-08_

## Nu
Runde 12 (11. okt): asset-biblioteket (jonvmnielsen/game-assets) tages i brug, fuld opløsning, ny balance i talportene.

- **Fra biblioteket** (`assets.json`, `node ../game-assets/tools/sync.mjs .`, så `tools/lib-audio.sh`):
  - Heltinder: KayKit Adventurers 2.0-heksen med 2.0-riggens animationer (kast = besværgelse) som Ild-, Frost- og Helbredelsesheltinde; også stenstatuerne i fængslerne.
  - Optagede lyde: Kenney Impact (træf, knogler, plader, sten), Kenney RPG (mønter, klæde, kniv der trækkes), Sonniss GDC (kød-træf, skjoldslag, eksplosion, metal, træ der knækker) og 24 zombie-stønnen fra horden (licens ikke verificeret, Jons beslutning D-010 i biblioteket). Lagt oven på de renderede dybe lyde.
- **Opløsning:** fuld skærmopløsning på telefonen (iPhone 3×), falder aldrig under 2×. MSAA sænkes til 2× ved 3× opløsning for at spare.
- **Talporte:**
  - Porte følger truppens størrelse (ca. 20-35 % af truppen), så de betyder lige meget sent i banen.
  - Aldrig samme slags port i begge sider: *sikker vs. chance* (fast +N mod en minusport der kan skydes op til et loft over N), *×2 vs. lille plus der kan skydes op*, eller *fælde* (fast minus ved siden af et fast plus).
  - Kun porte med ▲ kan skydes op, og kun til deres loft ("▲ op til +36", derefter MAX). Prisen sættes efter truppens ildkraft, så det altid tager ca. 4,5 s af hele truppens ild at skyde en port helt op, og hvert point koster lidt mere end det forrige.
- **Bane 1 blødere:** 20 soldater fra start, to våbenmøder i åbningen, intet slut-stormløb, boss 6.500 liv. Bot-test: 5/6 sejre.

## Udgivelse
- Live på https://jonvmnielsen.github.io/Horde-defense/ (GitHub Pages, udgives automatisk ved push til `main`).

## Næste
1. Jon tester talporte, valgene, lyd/musik og basen.
2. Ny fanebærer og heltinder i bure, når pakkerne er hentet (se docs/ASSETS.md).
2. Jon henter de pakker i `docs/ASSETS.md`, der skal med.
2. Tema: soldater mod zombier, når Jon har lagt Quaternius-pakkerne (Toon Shooter, Zombies, Animated Women) i repoet.
3. Kvindelige helte (snigskytte, læge, sprængstofekspert) i bure, når Jon har svaret på forslaget.
