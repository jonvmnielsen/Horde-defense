// Level tuning. Every number that decides difficulty lives here so balancing is one place.
// Checked with tools/sim.py (bots): staying in one lane loses; you have to grow the troop AND upgrade weapons.
// Damage unit: one soldier fires one bolt per crossbow animation loop (~1.07 s) for 1 damage x weapon multiplier.

export const TROOP = {
  visibleMax: 110, // soldiers drawn on screen; above this each drawn soldier fires for several (keeps the troop on screen)
  start: 12, // soldiers at the start of level 1 (each later level starts with startPerLevel more)
  startPerLevel: 8, // until the base exists, survivors go home instead of into the next level
  boltDamage: 1,
  range: 32, // how far ahead the crossbows reach (lanes are ~70 long)
  pierce: 6, // a bolt with damage left after a kill goes on through up to this many enemies behind it
};

// Weapon tiers, unlocked one at a time by breaking "VÅBEN +" chests in the side lanes (reset every level).
// bolt / flash are HDR colours (values above 1 glow through the bloom).
export const WEAPON = [
  { name: 'Armbrøst', mul: 1, bolt: [2.4, 1.7, 0.6], flash: [2.6, 1.9, 0.9], css: '#ffc533' },
  { name: 'Stålbolte', mul: 1.5, bolt: [2.6, 2.7, 2.9], flash: [2.6, 2.6, 2.6], css: '#e6eef5' },
  { name: 'Ildbolte', mul: 2.1, bolt: [3.4, 1.2, 0.25], flash: [3.2, 1.3, 0.3], css: '#ff7a1a' },
  { name: 'Frostbolte', mul: 2.8, bolt: [0.5, 1.9, 3.4], flash: [0.6, 1.9, 3.2], css: '#5ec8ff' },
  { name: 'Tordenbolte', mul: 3.6, bolt: [2.3, 0.9, 3.4], flash: [2.4, 1.0, 3.2], css: '#c06bff' },
];

// Side-lane events. Each side lane draws from its own shuffled copy of this deck, so left and right differ.
export const EVENTS = {
  deck: ['plus1', 'plus1', 'plus5', 'squad', 'squad', 'squad', 'fort', 'weapon', 'weapon', 'weapon2', 'prisoner', 'rapid', 'bomb'],
  gap: [0.1, 0.5], // seconds between events: the side lanes are never empty
};

export function levelConfig(n) {
  const k = n - 1; // 0 for the first level
  return {
    n,
    duration: 80 + k * 10, // seconds of horde before the boss arrives (this is the progress bar)
    // the middle horde is one packed mass that fills the lane from end to end
    hordeSpeed: [2.7 + k * 0.1, 3.9 + k * 0.15], // march speed at the start / end of the level (units per second)
    hordeWidth: [2.6 + k * 0.4, 8], // enemies per row across the 6-wide lane, start / end
    hordeWave: 0.3, // rows swell and thin in waves (+/- 30 %)
    rowGap: 0.8, // distance between rows
    hordeStartZ: -30, // the mass already fills the lane from here back when the level starts
    bossEscortWidth: 2.5,
    warriorShare: 0.06 + k * 0.01, // doubles by the end of the level
    hpGrowth: 3 + k * 0.5, // enemy health grows with progress squared (level 1: x1 -> x1.75 halfway -> x4 at the boss)
    director: { share: [0.9, 1.6], trim: [0.4, 3], target: 12, band: 3, rise: 0.08, fall: 0.25, lag: 5, grace: 12 }, // see updateDirector() in main.js
    minionHp: 1 + k * 0.15, // skeletons are many and weak: one bolt each at the start
    warriorHp: 7 + k,
    minionCost: 1, // soldiers lost when one reaches the troop
    warriorCost: 3,
    squadSize: [18, 48], // skeleton squads in the side lanes (grows over the level)
    plus1Hp: 2.5 + k * 0.3,
    plus5Hp: 12 + k * 2,
    fortHp: 1500 + k * 300, // wall guarding a +99 block
    plus99Hp: 180 + k * 30,
    weaponHp: 70 + k * 20, // "VÅBEN +" chest (one tier)
    rapidHp: 30, rapidTime: 10,
    bombHp: 35, bombRadius: 9, bombDamage: 40 + k * 10,
    bigWeaponWallHp: 450 + k * 120, // "VÅBEN ++": two weapon tiers at once, well guarded
    bigWeaponHp: 160 + k * 30,
    prisonHp: 320 + k * 70, // stone prison holding a hero
    maxHeroes: 3,
    heroDamage: 14 + k * 3, // fireball damage (x weapon multiplier) to everything in heroRadius
    heroRadius: 2.6,
    heroRange: 36,
    bossHp: 3000 + k * 1500,
    bossSeconds: 15, // the boss takes about this many seconds of the troop's full fire
    bossSpeed: 2.8,
    bossKillsPerSwing: 6 + k,
    gold: { minion: 1, warrior: 3, boss: 60 + k * 30, clear: 100 + k * 50 },
  };
}
