// Level tuning. Every number that decides difficulty lives here so balancing is one place.
// Checked with tools/sim.py (bots): staying in one lane loses; you have to grow the troop AND upgrade weapons.
// Damage unit: one soldier fires one bolt per crossbow animation loop (~1.07 s) for 1 damage x weapon multiplier.

export const TROOP = {
  visibleMax: 110, // soldiers drawn on screen; above this each drawn soldier fires for several (keeps the troop on screen)
  start: 12, // soldiers at the start of level 1 (each later level starts with startPerLevel more)
  startPerLevel: 8, // until the base exists, survivors go home instead of into the next level
  boltDamage: 1,
  range: 32, // how far ahead the crossbows reach (lanes are ~70 long)
};

// Weapon tiers, unlocked one at a time by breaking "VÅBEN +" chests in the side lanes (reset every level).
// bolt / flash are HDR colours (values above 1 glow through the bloom).
export const WEAPON = [
  { name: 'Armbrøst', mul: 1, bolt: [2.4, 1.7, 0.6], flash: [2.6, 1.9, 0.9], css: '#ffc533' },
  { name: 'Stålbolte', mul: 1.7, bolt: [2.6, 2.7, 2.9], flash: [2.6, 2.6, 2.6], css: '#e6eef5' },
  { name: 'Ildbolte', mul: 2.6, bolt: [3.4, 1.2, 0.25], flash: [3.2, 1.3, 0.3], css: '#ff7a1a' },
  { name: 'Frostbolte', mul: 3.8, bolt: [0.5, 1.9, 3.4], flash: [0.6, 1.9, 3.2], css: '#5ec8ff' },
  { name: 'Tordenbolte', mul: 5.4, bolt: [2.3, 0.9, 3.4], flash: [2.4, 1.0, 3.2], css: '#c06bff' },
];

// Side-lane events. Each side lane draws from its own shuffled copy of this deck, so left and right differ.
export const EVENTS = {
  deck: ['plus1', 'plus1', 'plus1', 'plus1', 'plus5', 'plus5', 'squad', 'squad', 'fort', 'weapon', 'weapon', 'rapid', 'bomb'],
  gap: [0.8, 2.4], // seconds of empty lane between events
};

export function levelConfig(n) {
  const k = n - 1; // 0 for the first level
  return {
    n,
    duration: 80 + k * 10, // seconds of horde before the boss arrives (this is the progress bar)
    spawnStart: 2.0 + k * 0.3, // middle-lane enemies per second at the start (gentle: time to grow the troop)
    spawnEnd: 9.5 + k * 0.8, // ... and just before the boss (ramps up faster towards the end)
    burstChance: 0.08,
    burst: [25, 50], // size of a sudden rush
    warriorShare: 0.12 + k * 0.02, // doubles by the end of the level
    hpGrowth: 1.1 + k * 0.15, // enemy health multiplier added over the level (level 1: x1 -> x2.4)
    minionHp: 2.5 + k * 0.3,
    warriorHp: 11 + k * 1.5,
    enemySpeed: 5.4 + k * 0.15, // world units per second (lane ~70 long: ~12 s to reach the troop)
    minionCost: 1, // soldiers lost when one reaches the troop
    warriorCost: 3,
    squadSize: [5, 16], // skeleton squads in the side lanes (grows over the level)
    plus1Hp: 2.5 + k * 0.3,
    plus5Hp: 12 + k * 2,
    fortHp: 600 + k * 150, // wall guarding a +99 block
    plus99Hp: 70 + k * 10,
    weaponWallHp: 120 + k * 50, // wall guarding a weapon chest
    weaponHp: 50 + k * 10,
    rapidHp: 30, rapidTime: 10,
    bombHp: 35, bombRadius: 9, bombDamage: 40 + k * 10,
    bossHp: 9000 + k * 2000,
    bossSpeed: 2.8,
    bossKillsPerSwing: 6 + k,
    bossEscortRate: 3 + k * 0.3, // enemies per second while the boss walks
    gold: { minion: 1, warrior: 3, boss: 60 + k * 30, clear: 100 + k * 50 },
  };
}
