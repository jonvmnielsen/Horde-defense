# Arkitektur

```
public/assets/*.glb   trimmede modeller (bygget af tools/build-assets.mjs fra KayKit)
src/main.js           opsætning (renderer, lys, post-processing), spillogik, HUD, input
src/vat.js            bager glTF-animationer til teksturer + instanced "Crowd"-pulje
src/world.js          statisk miljø: spor, gårdsplads, kirkegård, ruiner, skov, himmel
src/fx.js             partikler, armbrøstbolte, flydende tal
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
