// Builds trimmed game assets from the KayKit CC0 packs.
// Characters: keep only needed animations + props. Environment: merge pieces into one env.glb.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, mergeDocuments, unpartition, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const SRC = '/home/claude/assets_dl';
const OUT = path.resolve('public/assets');
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const SK = `${SRC}/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf`;
const AD = `${SRC}/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf`;

const characters = [
  { src: `${SK}/Skeleton_Minion.glb`, out: 'skeleton_minion.glb',
    anims: ['Running_A', 'Walking_D_Skeletons', 'Death_C_Skeletons', 'Death_A', '1H_Melee_Attack_Chop'], drop: [] },
  { src: `${SK}/Skeleton_Warrior.glb`, out: 'skeleton_warrior.glb',
    anims: ['Running_A', 'Walking_D_Skeletons', 'Death_C_Skeletons', '2H_Melee_Attack_Chop', 'Hit_A', 'Idle_Combat'], drop: [] },
  // low-poly skeleton for the big horde (~35% of the triangles; they are small on screen)
  { src: `${SK}/Skeleton_Minion.glb`, out: 'skeleton_minion_lod.glb', simplify: 0.25,
    anims: ['Running_A', 'Walking_D_Skeletons', 'Death_C_Skeletons'], drop: [] },
  { src: `${SK}/Skeleton_Warrior.glb`, out: 'skeleton_warrior_lod.glb', simplify: 0.3,
    anims: ['Running_A', 'Walking_D_Skeletons', 'Death_C_Skeletons'], drop: [] },
  // enemy hero: the skeleton mage that stops in the lane and blasts the troop from range
  { src: `${SK}/Skeleton_Mage.glb`, out: 'skeleton_mage.glb',
    anims: ['Walking_D_Skeletons', 'Spellcast_Shoot', 'Death_C_Skeletons', 'Idle'], drop: [] },
  // banner bearer at the front of the troop
  { src: `${AD}/Knight.glb`, out: 'knight.glb', anims: ['Idle', 'Running_A', 'Cheer'],
    drop: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'] },
  // hero: the mage freed from the stone prison
  { src: `${AD}/Mage.glb`, out: 'mage.glb',
    anims: ['Spellcast_Shoot', 'Idle', 'Running_A', 'Cheer', 'Death_A'],
    drop: ['Spellbook', 'Spellbook_open', '1H_Wand'] },
  { src: `${AD}/Rogue_Hooded.glb`, out: 'rogue.glb',
    anims: ['2H_Ranged_Shooting', '2H_Ranged_Aiming', 'Running_A', 'Death_A', 'Cheer'],
    drop: ['Knife_Offhand', '1H_Crossbow', 'Knife', 'Throwable'] },
];

for (const c of characters) {
  const doc = await io.read(c.src);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!c.anims.includes(a.getName())) {
    for (const ch of a.listChannels()) ch.dispose();
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  for (const n of root.listNodes()) if (c.drop.includes(n.getName())) n.dispose();
  for (const a of root.listAnimations()) {
    for (const s of a.listSamplers()) if (!a.listChannels().some((ch) => ch.getSampler() === s)) s.dispose();
  }
  await doc.transform(prune(), dedup());
  if (c.simplify) {
    await MeshoptSimplifier.ready;
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: c.simplify, error: 0.06, lockBorder: false }));
  }
  for (const acc of root.listAccessors()) {
    if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
  }
  await io.write(path.join(OUT, c.out), doc);
  console.log(c.out, (fs.statSync(path.join(OUT, c.out)).size / 1024).toFixed(0), 'KB',
    root.listAnimations().map((a) => a.getName()).join(','));
}

// ---- Environment ----
const HW = `${SRC}/KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf`;
const DG = `${SRC}/KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf`;
const HX = `${SRC}/KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf`;
function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findFile(p, name); if (r) return r; }
    else if (e.name === name) return p;
  }
  return null;
}
const envList = [
  ...['fence', 'fence_broken', 'fence_pillar', 'fence_pillar_broken', 'grave_A', 'grave_B', 'grave_A_destroyed', 'gravestone',
    'gravemarker_A', 'gravemarker_B', 'tree_dead_large', 'tree_dead_medium', 'tree_dead_small', 'crypt', 'lantern_standing',
    'post_lantern', 'post_skull', 'arch_gate', 'skull', 'ribcage', 'bone_A', 'bone_B', 'shrine_candles', 'coffin', 'candle_triple',
    'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium']
    .map((n) => [n, `${HW}/${n}.gltf`]),
  ...['wall', 'wall_broken', 'wall_half', 'wall_cracked', 'wall_pillar', 'rubble_large', 'rubble_half', 'pillar', 'column',
    'barrier', 'barrier_column', 'barrier_half', 'floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small_broken_A',
    'torch_lit', 'banner_patternA_red', 'banner_thin_blue', 'barrel_large', 'crates_stacked', 'box_large', 'sword_shield_broken', 'box_small', 'keg_decorated', 'coin_stack_large']
    .map((n) => [n, `${DG}/${n}.gltf.glb`]),
  ...['chest', 'chest_gold'].map((n) => [n, `${DG}/${n}.glb`]),
  ...['building_destroyed', 'building_tower_A_blue', 'building_tower_catapult_blue', 'rock_single_A', 'rock_single_B',
    'rock_single_C', 'rock_single_D', 'mountain_A', 'mountain_B', 'mountain_C', 'hills_A_trees', 'trees_B_large', 'flag_blue', 'tent']
    .map((n) => [n, findFile(HX, `${n}.gltf`)]),
];

const env = (await io.read(envList[0][1]));
{
  const r = env.getRoot(); const s = r.getDefaultScene() || r.listScenes()[0];
  const wrap = env.createNode(envList[0][0]);
  for (const ch of s.listChildren()) { s.removeChild(ch); wrap.addChild(ch); }
  s.addChild(wrap);
}
const mainScene = env.getRoot().listScenes()[0];
for (const [name, file] of envList.slice(1)) {
  if (!file || !fs.existsSync(file)) { console.warn('missing', name, file); continue; }
  const d = await io.read(file);
  const s = d.getRoot().getDefaultScene() || d.getRoot().listScenes()[0];
  const wrap = d.createNode(name);
  for (const ch of s.listChildren()) { s.removeChild(ch); wrap.addChild(ch); }
  s.addChild(wrap);
  for (const a of d.getRoot().listAnimations()) a.dispose();
  const map = mergeDocuments(env, d);
  const newScene = map.get(s);
  for (const ch of newScene.listChildren()) { newScene.removeChild(ch); mainScene.addChild(ch); }
  newScene.dispose();
}
await env.transform(unpartition(), dedup(), prune());
await io.write(path.join(OUT, 'env.glb'), env);
console.log('env.glb', (fs.statSync(path.join(OUT, 'env.glb')).size / 1024).toFixed(0), 'KB',
  'textures', env.getRoot().listTextures().length, 'nodes', mainScene.listChildren().length);
