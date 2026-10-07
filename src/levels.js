// Level tuning. Every number that decides difficulty lives here so balancing is one place.
// Levels get only mildly harder for now; the big difficulty curve comes later with base upgrades.
// Checked with tools/sim.py (bots): one-lane play loses, lane-switching wins.
// Damage unit: one soldier fires one bolt per crossbow animation loop (~1.07 s) for 1 damage.

export const TROOP = {
  visibleMax: 150, // soldiers drawn on screen; above this each drawn soldier fires for several
  start: 12, // soldiers at the start of level 1 (each later level starts with startPerLevel more)
  startPerLevel: 8, // until the base exists, survivors go home instead of into the next level
  boltDamage: 1,
};

export function levelConfig(n) {
  const k = n - 1; // 0 for the first level
  return {
    n,
    duration: 75 + k * 10, // seconds of horde before the boss arrives (this is the progress bar)
    spawnStart: 3.0 + k * 0.2, // enemies per second at the start of the level
    spawnEnd: 8.2 + k * 0.4, // enemies per second just before the boss
    burstChance: 0.07 + k * 0.005, // chance per spawn tick of a rush of 20-45 skeletons
    warriorShare: 0.12 + k * 0.03, // grows to x2 by the end of the level
    hpGrowth: 0.7 + k * 0.05, // enemy health multiplier added over the level (level 1: x1 at start, x1.8 at the boss)
    minionHp: 3 + k * 0.2,
    warriorHp: 10 + k,
    enemySpeed: 4.4 + k * 0.1, // world units per second (lane is ~72 long: ~16 s to reach the troop)
    minionCost: 1, // soldiers lost when one reaches the troop
    warriorCost: 3,
    plus1Hp: 5 + k * 0.5,
    plus1Interval: 1.15,
    wallHp: 600 + k * 100,
    plus99Hp: 60 + k * 10,
    plus99Count: 2,
    bossHp: 4500 + k * 800,
    bossSpeed: 2.6,
    bossKillsPerSwing: 6 + k,
    bossEscortRate: 2.5 + k * 0.3, // enemies per second while the boss walks
    gold: { minion: 1, warrior: 3, boss: 60 + k * 30, clear: 100 + k * 50 },
  };
}
