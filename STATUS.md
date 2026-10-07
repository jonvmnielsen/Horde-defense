# Status

_Senest opdateret: 2026-10-07_

## Nu
Runde 2 efter Jons første test: balance, banestruktur og finish.

- **Bane-struktur:** hver bane varer ~75 s med en fremskridtsbjælke øverst og ender med bossen (Skeletkongen). Dræbt boss = bane klaret → næste bane. Truppen falder = prøv igen.
- **Trup:** antallet er ubegrænset; højst 150 soldater vises, og hver vist soldat skyder for flere, når truppen er større.
- **Skydning:** hver soldat skyder én bolt pr. armbrøst-animation, i takt med animationen. Står sporet tomt, sigter soldaten i stedet.
- **Fjender:** hurtigere (~4,4 enheder/s), bliver sejere gennem banen, flere krigere mod slutningen.
- **Skygger:** alle figurer kaster rigtige, animerede skygger; lyset kommer fra siden, så skyggerne kan ses.
- **Balance (bot-test, `tools/sim.py`):** spiller man kun ét spor, taber man på bane 1. Skifter man spor (+1 → mur → forsvar), klares bane 1 og 2. Bane 3+ er svære; den rigtige sværhedskurve kommer med basen.

## Udgivelse
- Live på https://jonvmnielsen.github.io/Horde-defense/ (GitHub Pages, udgives automatisk ved push til `main`).
- Claudes egen artifact-visning afviser Jons iPhone; derfor GitHub Pages.

## Næste
1. Jon tester runde 2 på telefon: sværhed, fart, skydning, skygger.
2. Beslut tema (fantasy som nu, eller moderne militær med andre modeller).
3. Trup-loft eller bedre våben (se DECISIONS).
