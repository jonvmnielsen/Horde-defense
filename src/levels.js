// Level tuning. Every number that decides difficulty lives here so balancing is one place.
// Checked with tools/sim.py (bots): staying in one lane loses; a troop that grows and upgrades must always be able to win.
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
  deck: ['plus1', 'plus1', 'plus5', 'squad', 'squad', 'squad', 'fort', 'weapon', 'weapon', 'weapon2', 'prisoner', 'prisoner', 'barrels', 'rapid', 'bomb'],
  gap: [0.1, 0.5], // seconds between events: the side lanes are never empty
};

// Enemy types. Their strength is FIXED: they never scale with the player. Pressure comes from numbers and from special types.
// hp is multiplied by the level's hpScale (a little more each level). cost = soldiers lost when one reaches the troop.
export const ENEMY = {
  minion: { hp: 1, cost: 1, gold: 1, scale: 1 }, // the endless mass
  warrior: { hp: 14, cost: 3, gold: 3, scale: 1 }, // armoured skeletons mixed into the mass
  brute: { hp: 45, cost: 6, gold: 6, scale: 1.3 }, // Kæmpe: a big armoured skeleton, more of them late in the level
  elite: { hp: 160, cost: 12, gold: 25, troops: 10, scale: 1.55 }, // Guldkriger: big, golden, pays +10 soldiers
};

export function levelConfig(n) {
  const k = n - 1; // 0 for the first level
  return {
    n,
    duration: 80 + k * 10, // seconds of horde before the boss arrives (this is the progress bar)
    hpScale: 1 + k * 0.35, // every enemy type is a bit tougher on each new level (never during a level)
    minionHp: k < 2 ? 1 : 1 + (k - 1) * 0.5, // the basic skeleton stays one-shot on level 2 (a crossbow bolt does 1), then gets tougher in steps
    // the middle horde is one packed mass that fills the lane from end to end
    hordeSpeed: [3.2 + k * 0.1, 5.2 + k * 0.15], // running speed at the start / end of the level (units per second)
    hordeWidth: [2.4 + k * 0.5, 9], // enemies per row across the 7.5-wide lane, start / end
    hordeWave: 0.3, // rows swell and thin in waves (+/- 30 %)
    rowGap: 1.0, // distance between rows (they run, so rows are a little further apart)
    hordeStartZ: -30, // the mass already fills the lane from here back when the level starts
    bossEscortWidth: 2.5,
    warriorShare: [0.04, 0.4 + k * 0.03], // share of armoured warriors in the mass, start / end of the level
    bruteShare: [0, 0.2 + k * 0.03], // share of Kæmper (from 30 % of the level)
    eliteEvery: 6 - Math.min(3, k * 0.7), // seconds between Guldkrigere
    rush: { time: 3.5, speed: 1.5, width: [5, 9] }, // STORMLØB: a wide block that sprints (narrower early in the level)
    caster: { hp: 300 + k * 150, stopAt: 24, interval: 2.2 - Math.min(0.6, k * 0.2), kills: 5 + k * 2, gold: 60, troops: 25 },
    // scripted events (at = share of the level): rushes and Skeletmagikere in a side lane
    timeline: [
      { at: 0.2, type: 'rush' },
      { at: 0.42, type: 'caster' },
      { at: 0.5, type: 'rush' },
      { at: 0.68, type: 'caster' },
      { at: 0.8, type: 'rush' },
      ...(k >= 1 ? [{ at: 0.9, type: 'caster' }] : []),
      // ×2 gates ride inside the horde: thin the mass in front of them to reach them in time
      { at: 0.3, type: 'mult' },
      { at: 0.62, type: 'mult' },
    ],
    mult: { hp: 420 + k * 160, cap: 150 + k * 80 }, // ×2 doubles the troop, but never adds more than cap
    escort: 10, // warriors marching in front of fortresses and VÅBEN ++
    altar: { hp: 25, share: 0.3, min: 15 }, // OFFERPORT: costs 30 % of the troop (at least 15), hands over VÅBEN ++ or a hero
    // rolling hazards: shoot them or get out of the way. Barrels blow up (also in the horde: good to shoot!), boulders crush.
    hazard: { every: 9, boulderShare: 0.35, barrel: { hp: 6, speed: 6.5, radius: 0.7, kills: 14, blast: 4.5, damage: 30 }, boulder: { hp: 260, speed: 5, radius: 1.6, kills: 22 } },
    squadSize: [18, 40], // skeleton squads in the side lanes (grows over the level)
    plus1Hp: 2.5 + k * 0.3,
    plus5Hp: 12 + k * 2,
    fortHp: 2200 + k * 400, // wall guarding a +99 block
    // reward budget per level: once spent, the side lanes deal squads, +1 rows, bombs and rapid fire instead
    budget: { fort: 2, weapon: 3, weapon2: 1, prisoner: 2 }, // OFFERPORT (altar) is parked: the code stays, it is just not dealt
    plus99Hp: 150 + k * 30,
    weaponHp: 45 + k * 20, // "VÅBEN +" chest (one tier)
    rapidHp: 30, rapidTime: 10,
    bombHp: 35, bombRadius: 9, bombDamage: 40 + k * 10,
    bigWeaponWallHp: 450 + k * 120, // "VÅBEN ++": two weapon tiers at once, well guarded
    bigWeaponHp: 160 + k * 30,
    prisonHp: 320 + k * 70, // stone prison holding a hero
    maxHeroes: 3,
    heroDamage: 14 + k * 3, // fireball damage (x weapon multiplier) to everything in heroRadius
    heroRadius: 2.6,
    heroRange: 36,
    heroHeal: 3 + k, // HELBREDER: soldiers back on their feet per spell (about every 2 s)
    frostSlow: 3, // FROSTMAGIKER: seconds a frozen enemy crawls at a third of its speed
    bossHp: 11000 + k * 7000, // fixed per level
    bossSpeed: 2.8,
    bossKillsPerSwing: 6 + k,
    bossThrow: { every: 3.2, warn: 1.5, radius: 2.4, kills: 8 + k * 2 }, // rocks thrown at the troop: a red ring warns where it lands
    stars: [250 + k * 150, 500 + k * 300], // soldiers left at the end for ★★ and ★★★ (★ = level cleared)
    gold: { boss: 60 + k * 30, clear: 100 + k * 50 },
  };
}

// The base between levels. Gold from every level (won or lost) buys these; survivors of a won level wait in the barracks.
export const BASE = {
  // KASERNE: how many survivors the barracks can keep for the next level
  barracks: { name: 'Kaserne', what: 'Overlevende der venter til næste bane', levels: [10, 25, 50, 100, 200], cost: [0, 250, 700, 1600, 3500] },
  // VÅBENSMED: weapon tier every level starts with
  smith: { name: 'Våbensmed', what: 'Våbnet du starter hver bane med', levels: [0, 1, 2], cost: [0, 900, 2600] },
  // HELTEHAL: heroes that march out with the troop at the start of a level
  hall: { name: 'Heltehal', what: 'Helte der følger med fra start', levels: [0, 1, 2], cost: [0, 1200, 3200] },
};
export const LEVEL_COUNT = 12; // levels on the map (the game keeps going; the map just shows this many)
