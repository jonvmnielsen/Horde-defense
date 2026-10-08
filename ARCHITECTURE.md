# Arkitektur

```
public/assets/*.glb   trimmede modeller (bygget af tools/build-assets.mjs fra KayKit)
src/main.js           opsætning (renderer, lys, post-processing), spillogik, HUD, input
src/vat.js            bager glTF-animationer til teksturer + instanced "Crowd"-pulje
src/world.js          statisk miljø: spor, gårdsplads, kirkegård, ruiner, skov, himmel
src/fx.js             partikler, armbrøstbolte, flydende tal
src/audio.js          syntetiserede lydeffekter (WebAudio) og vibration; låses op ved første berøring
src/props.js          PropSet: instanced kopier af en statisk model (kister, kasser, porte)
src/levels.js         al balance: banelængde, fjendetal, liv, mur, boss, guld
tools/sim.py          spiller hele baner headless med bots og printer resultatet
index.html            HUD og styling
build.mjs             esbuild-bundle + glb → glTF-JSON → dist/
.github/workflows     bygger og udgiver dist/ til GitHub Pages ved push til main
```

## Animerede menneskemængder (VAT)
Ved indlæsning afspilles hver valgt animation på CPU'en, og hver vertex' position og normal gemmes pr. frame i en half-float tekstur. En `InstancedMesh` læser teksturen i vertex-shaderen; hver instans har sit eget klip, starttid og hastighed (`iClip`) og et blink-felt (`iFlash`). Det giver ét draw call pr. figurtype uanset antal.

## Spillogik (main.js)
- Mål pr. spor sorteres nærmest først; hvert skud reserverer skade (`pending`), så ilden spredes uden overkill.
- Truppen står i en solsikke-formation, der bliver bredere med størrelsen; hver soldat skyder i det spor, den står i.
- Fjender, der når gårdspladsen, stormer truppen og koster soldater (skelet 1, kriger 3).
- `S.count` er truppens rigtige antal; højst `TROOP.visibleMax` vises. Skud-skade = antal / viste.
- Banens faser: `horde` → `boss` → `won` / `lost`. Fremskridt = tid / `duration`.
- Sidespor: `S.side[]` trækker hændelser fra `EVENTS.deck` (levels.js); `sideEvent()` lægger genstande (`S.items`) og mure (`S.walls`) på transportbåndet. Genstande kan ikke passere en stående mur i samme spor.
- Våben: `S.weapon` indekserer `WEAPON[]` (skade-multiplikator og boltfarve). `S.rapid` = sekunder tilbage med 2× skud.
- `tools/sim.py` bruger `botTarget()`: forsvar sporet med størst trussel, ellers det spor med bedst belønning pr. liv.
- Animerede figurer kaster skygger via `createVatDepthMaterial` (samme VAT-opslag i dybde-pass).

## Horden og fjendetyper
- `spawnRow()` lægger en række skeletter på tværs af et spor; `hordeWidth()` giver antal pr. række (vokser over banen, med bølger).
- `ENEMY` i levels.js: fast liv, pris (soldater tabt) og guld pr. type. `spawnEnemy()` vælger type efter banens fremskridt.
- `pierce()` sender overskydende skade videre til de nærmeste skeletter bag målet.
- Banens `timeline`: stormløb (`S.rush`) og skeletmagikere (`spawnCaster`, `updateCasters`, kugler i `S.orbs`).
- `budget` i levels.js begrænser fæstninger, våbenkister og fanger pr. bane (`S.spent`).

## Runde 8: helte, boss, kampagne
- Tre heltetyper (`HERO` i main.js): ILDMAGIKER (ildkugle), FROSTMAGIKER (bremser fjender, `e.slow`), HELBREDER (`heroHeal` soldater pr. besværgelse). Hver har sin egen `Crowd` i `heroCrowds`; en fange bærer `it.hero`.
- ×2-porten (`mult`) kommer via `timeline` i midtersporet og kører med hordens fart; giver `min(antal, mult.cap)` soldater.
- Bossen kaster sten (`throwRock`, `S.rocks`); en rød ring (tegnet oven på alt) viser nedslaget `bossThrow.warn` sekunder før.
- Fanebærer (ridder + flag) står foran truppen; soldaterne får en svag kantglød i våbnets farve (`troopRim`).
- Ild og røg: `updateFires()` udsender partikler ved `world.fires` (fakler, bål) og `world.smokes`.
- Skærmblink (`flashScreen`) ved store drab; skadetal på boss og skeletmagikere (`updateDamageNumbers`).
- Kampagne: `save` i localStorage (`hordeforsvar.v1`: guld, kaserne-reserve, låst op til, stjerner, opgraderinger). `beginLevel(n)` anvender basen (reserve, startvåben, startHelte) og kalder `startLevel`; `settleLevel()` bogfører resultatet én gang. Fasen `menu` fryser slagmarken bag kort/base.
- `BASE` og `LEVEL_COUNT` i levels.js; stjerner efter overlevende (`stars`).
- Test-parametre: `snap` (direkte i spillet, ingen menu), `level=`, `boss`, `mult`, `heroes`, `menu=map|base`, `gold=`.

## Runde 9: feedback og base
- `troopDelta(n)` viser "+N"/"-N" ved tælleren og får den til at hoppe; kaldes fra `gainTroops`/`loseTroops`.
- `showBanner()` skriver øverst (CSS `#banner`); `weaponUp()` samler alt ved nyt våben; `freeze(t)` giver hit-stop i `frame()`.
- `BASE` i levels.js: hver opgradering har `max`, `cost(lv)`, `value(lv)`, `text(v)` og en gruppe. `beginLevel` omsætter dem til `S.mods` (dmg, rate, hero, power, gold, medic) og startsoldater.
- Gemt spil: `hordeforsvar.v2`.
