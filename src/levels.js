// Level tuning. Every number that decides difficulty lives here so balancing is one place.
// Checked with tools/sim.py (bots): staying in one lane loses; a troop that grows and upgrades must always be able to win.
// Damage unit: one soldier fires one bolt per crossbow animation loop (~1.07 s) for 1 damage x weapon multiplier.

export const TROOP = {
  visibleMax: 90, // soldiers drawn on screen; above this each drawn soldier fires for several (keeps the troop on screen)
  start: 16, // soldiers at the start of level 1 (each later level starts with startPerLevel more)
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
  minion: { hp: 1, cost: 1, gold: 0, scale: 0.92 }, // the endless mass
  warrior: { hp: 14, cost: 3, gold: 0.15, scale: 1.35 }, // armoured skeletons mixed into the mass
  brute: { hp: 45, cost: 6, gold: 0.5, scale: 1.95 }, // Kæmpe: a big armoured skeleton, more of them late in the level
  elite: { hp: 160, cost: 12, gold: 5, troops: 10, scale: 2.5 }, // Guldkriger: big, golden, pays +10 soldiers
};

export function levelConfig(n) {
  const k = n - 1; // 0 for the first level
  return {
    n,
    duration: Math.min(110, 45 + k * 8), // short first levels (45 s), longer later // seconds of horde before the boss arrives (this is the progress bar)
    hpScale: 1 + k * 0.35, // every enemy type is a bit tougher on each new level (never during a level)
    minionHp: k < 2 ? 1 : 1 + (k - 1) * 0.5, // the basic skeleton stays one-shot on level 2 (a crossbow bolt does 1), then gets tougher in steps
    // the middle horde is one packed mass that fills the lane from end to end
    hordeSpeed: [2.9 + k * 0.1, 5.0 + k * 0.15], // running speed at the start / end of the level (units per second)
    hordeWidth: [2.8 + k * 0.55, 10], // enemies per row across the 7.5-wide lane, start / end
    hordeWave: 0.3, // rows swell and thin in waves (+/- 30 %)
    rowGap: 0.8, // distance between rows: shoulder to shoulder, one dense mass
    hordeStartZ: -30, // the mass already fills the lane from here back when the level starts
    bossEscortWidth: 2.5,
    warriorShare: [0.04, 0.4 + k * 0.03], // share of armoured warriors in the mass, start / end of the level
    bruteShare: [0, 0.2 + k * 0.03], // share of Kæmper (from 30 % of the level)
    eliteEvery: 6 - Math.min(3, k * 0.7), // seconds between Guldkrigere
    rush: { time: 3.5, speed: 1.5, width: [5, 9] }, // STORMLØB: a wide block that sprints (narrower early in the level)
    caster: { hp: 300 + k * 150, stopAt: 24, interval: 2.2 - Math.min(0.6, k * 0.2), kills: 5 + k * 2, gold: 30, troops: 25 },
    // scripted events (at = share of the level): rushes and Skeletmagikere in a side lane
    timeline: [
      ...(k >= 1 ? [{ at: 0.25, type: 'rush' }] : []), // level 1 is gentle: one caster and a final rush
      { at: 0.5, type: 'caster' },
      ...(k >= 1 ? [{ at: 0.62, type: 'rush' }] : []),
      { at: 0.85, type: 'rush' },
      ...(k >= 1 ? [{ at: 0.8, type: 'caster' }] : []),
      ...(k >= 2 ? [{ at: 0.3, type: 'caster' }] : []),
      // ×2 gates ride inside the horde: be in the middle when they arrive
      { at: 0.35, type: 'mult' },
      { at: 0.72, type: 'mult' },
    ],
    mult: { hp: 420 + k * 160, cap: 150 + k * 80 }, // ×2 doubles the troop, but never adds more than cap
    escort: 8, // warriors marching in front of fortresses and VÅBEN ++
    // side lanes come in paired ENCOUNTERS: both sides arrive at the same moment, so you pick one (or stay home in the middle)
    encounters: {
      gap: [1.2, 2.4], // seconds between encounters
      deck: ['gates', 'gates', 'gates', 'smallbig', 'smallbig', 'weapon', 'power', 'squads', 'hazard'],
      opening: ['gates', 'weapon', 'gates', 'smallbig'], // first encounters of every level, in order
    },
    // number gates: run through them. Shooting a gate raises its number by 1 per gateStep damage (so -8 can become +5)
    gate: { add: [4 + k * 1.5, 12 + k * 3], minus: [4 + k * 2, 12 + k * 4], step: 5 + k * 2.5, max: 99, multCap: 90 + k * 40 },
    smallCrates: [8, 12], // the "many small" side: +2 crates scattered across the lane
    altar: { hp: 25, share: 0.3, min: 15 }, // OFFERPORT: costs 30 % of the troop (at least 15), hands over VÅBEN ++ or a hero
    // rolling hazards: shoot them or get out of the way. Barrels blow up (also in the horde: good to shoot!), boulders crush.
    hazard: { every: 9, boulderShare: 0.35, barrel: { hp: 6, speed: 6.5, radius: 0.7, kills: 14, blast: 4.5, damage: 30 }, boulder: { hp: 260, speed: 5, radius: 1.6, kills: 22 } },
    squadSize: [18, 40], // skeleton squads in the side lanes (grows over the level)
    // pickups: soldiers gained when the troop catches them (+1 crates are worth more now that you must be there)
    gains: { plus1: 2, plus5: 8, plus99: 60 },
    plus1Hp: 2.5 + k * 0.3,
    plus5Hp: 12 + k * 2,
    fortHp: 700 + k * 220, // wall guarding a +99 block; it rolls on and crushes the troop if it is not shot down
    wallKills: 18 + k * 4, // soldiers lost when a wall reaches the troop in its lane
    // reward budget per level: once spent, the side lanes deal squads, +1 rows, bombs and rapid fire instead
    budget: { fort: 2, weapon: 3, weapon2: 1, prisoner: 2 }, // OFFERPORT (altar) is parked: the code stays, it is just not dealt
    plus99Hp: 150 + k * 30,
    weaponHp: 45 + k * 20, // "VÅBEN +" chest (one tier)
    rapidHp: 30, rapidTime: 10,
    bombHp: 35, bombRadius: 9, bombDamage: 40 + k * 10,
    bigWeaponWallHp: 400 + k * 120, // "VÅBEN ++": two weapon tiers at once, well guarded
    bigWeaponHp: 160 + k * 30,
    prisonHp: 320 + k * 70, // stone prison holding a hero
    maxHeroes: 3,
    heroDamage: 14 + k * 3, // fireball damage (x weapon multiplier) to everything in heroRadius
    heroRadius: 2.6,
    heroRange: 36,
    heroHeal: 3 + k, // HELBREDER: soldiers back on their feet per spell (about every 2 s)
    frostSlow: 3, // FROSTMAGIKER: seconds a frozen enemy crawls at a third of its speed
    bossHp: 9000 + k * 9000, // fixed per level
    bossSpeed: 2.8,
    bossKillsPerSwing: 6 + k,
    bossThrow: { every: 3.2, warn: 1.5, radius: 2.4, kills: 8 + k * 2 }, // rocks thrown at the troop: a red ring warns where it lands
    stars: [300 + k * 250, 700 + k * 500], // soldiers left at the end for ★★ and ★★★ (★ = level cleared)
    // gold is the base's currency: most of it comes from finishing well (boss, clear, stars), not from the mass
    gold: { boss: 50 + k * 25, clear: 100 + k * 50, star: 40 + k * 20 },
  };
}

// The base between levels. Gold from every level (won or lost) buys upgrades; survivors of a won level wait in the barracks.
// Each upgrade: max level, cost(lv) = price of going from lv to lv+1, value(lv) = its effect at that level, text(v) = what it means.
const geo = (base, g) => (lv) => Math.round(base * Math.pow(g, lv) / 10) * 10;
export const BASE_GROUPS = ['Tropper', 'Våben', 'Helte', 'Økonomi'];
export const BASE = {
  training: { group: 'Tropper', icon: '🏋️', name: 'Træningslejr', what: 'Flere soldater ved start af hver bane', max: 12, cost: geo(80, 1.45),
    value: (lv) => lv * 4, text: (v) => '+' + v + ' soldater' },
  barracks: { group: 'Tropper', icon: '🛡️', name: 'Kaserne', what: 'Overlevende venter her til næste bane', max: 10, cost: geo(150, 1.5),
    value: (lv) => [10, 20, 35, 50, 75, 100, 140, 200, 275, 350, 450][lv], text: (v) => 'plads til ' + v },
  medic: { group: 'Tropper', icon: '⛑️', name: 'Lazaret', what: 'Chance for at en faldet soldat rejser sig igen', max: 8, cost: geo(200, 1.55),
    value: (lv) => lv * 4, text: (v) => v + ' %' },
  smith: { group: 'Våben', icon: '⚒️', name: 'Våbensmed', what: 'Våbnet du starter hver bane med', max: 3, cost: (lv) => [500, 1800, 6000][lv],
    value: (lv) => lv, text: (v) => ['Armbrøst', 'Stålbolte', 'Ildbolte', 'Frostbolte'][v] },
  sharp: { group: 'Våben', icon: '🎯', name: 'Skarpe bolte', what: 'Mere skade med alle våben', max: 10, cost: geo(150, 1.5),
    value: (lv) => lv * 8, text: (v) => '+' + v + ' % skade' },
  drill: { group: 'Våben', icon: '⏱️', name: 'Skydeøvelser', what: 'Soldaterne lader hurtigere', max: 8, cost: geo(200, 1.55),
    value: (lv) => lv * 5, text: (v) => '+' + v + ' % skudtakt' },
  powder: { group: 'Våben', icon: '💣', name: 'Krudtmagasin', what: 'Stærkere bomber og længere 2× skud', max: 5, cost: geo(250, 1.6),
    value: (lv) => lv * 20, text: (v) => '+' + v + ' %' },
  hall: { group: 'Helte', icon: '✨', name: 'Heltehal', what: 'Helte der følger med fra start', max: 3, cost: (lv) => [700, 2500, 7000][lv],
    value: (lv) => lv, text: (v) => v === 0 ? 'ingen' : v + (v === 1 ? ' helt' : ' helte') },
  heroes: { group: 'Helte', icon: '📜', name: 'Heltetræning', what: 'Heltene rammer hårdere, fryser længere og heler mere', max: 8, cost: geo(250, 1.55),
    value: (lv) => lv * 15, text: (v) => '+' + v + ' % kraft' },
  treasury: { group: 'Økonomi', icon: '💰', name: 'Skattekammer', what: 'Mere guld fra hver bane', max: 8, cost: geo(300, 1.6),
    value: (lv) => lv * 10, text: (v) => '+' + v + ' % guld' },
};
export const LEVEL_COUNT = 20; // levels on the map (the game keeps going; the map just shows this many)
