# Horde Defense – instruktioner til Claude

Mobilspil i 3D (Three.js): en trup armbrøstskytter står i bunden af tre spor og forsvarer sig mod horder. Jon er instruktør og ikke-teknisk; al implementering laves af Claude. Kommunikation med Jon foregår på dansk.

## Læs først
- `VISION.md` – hvad spillet er.
- `docs/DESIGN.md` – designdokumentet (besluttet, idébank, åbne spørgsmål).
- `STATUS.md` – hvor projektet står nu.
- `DECISIONS.md` – beslutninger og hvorfor.
- `ARCHITECTURE.md` – hvordan koden hænger sammen.

## Regler
- **Finish er et krav fra start.** Ingen figurer bygget af geometriske grundformer i kode. Figurer og miljø er rigtige 3D-modeller (glTF).
- **Licenser verificeres i den officielle LICENSE-fil** i kildens eget repo/pakke, aldrig fra tredjepart. Notér alle assets i `CREDITS.md`.
- **Intet slettes hårdt.** Filer der skal væk, flyttes til `_trash/`.
- **Opdatér `STATUS.md` og `DECISIONS.md`** når noget ændres eller besluttes.
- **QA før noget er færdigt:** byg (`npm run build`), tag et skærmbillede i telefonformat (`python3 tools/shot.py shots/x.png 60 snap`) og se på det, før det meldes færdigt.
- Spillet skal kunne testes på mobil: hvert push til `main` udgives automatisk til GitHub Pages.

## Kommandoer
- `npm ci` – installér.
- `npm run build` – bundler `src/` til `dist/` og konverterer modeller til glTF-JSON.
- `npm run assets` – genbygger modeller fra KayKit-kilderne (kræver at kildepakkerne er klonet til `/home/claude/assets_dl`).
- `python3 tools/shot.py <ud.png> <frames> "<query>"` – headless skærmbillede (query `snap` = deterministisk, `pr=2` = skarpere, `cam=x,y,z,tx,ty,tz` = fri kamera).
