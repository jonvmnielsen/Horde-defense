// Static environment: lanes, courtyard, ruined graveyard surroundings, sky.
import * as THREE from 'three';

export const LANE_W = 4;
export const LANES = [-LANE_W, 0, LANE_W]; // lane centre x
export const LANE_START_Z = -78; // far end
export const LANE_END_Z = -6; // where lanes open into the courtyard

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Collect each named piece of env.glb as a list of {geometry, material, matrix} */
function pieceLibrary(envGltf) {
  const lib = {};
  envGltf.scene.updateMatrixWorld(true);
  for (const node of envGltf.scene.children) {
    const meshes = [];
    const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
    node.traverse((o) => {
      if (o.isMesh) meshes.push({ geometry: o.geometry, material: o.material, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
    });
    lib[node.name] = meshes;
  }
  return lib;
}

export function buildWorld(scene, envGltf) {
  const lib = pieceLibrary(envGltf);
  const placements = {}; // name -> [Matrix4]
  const r = rng(7);
  const tmp = new THREE.Object3D();
  function place(name, x, y, z, rotY = 0, s = 1, sy) {
    if (!lib[name]) { console.warn('no piece', name); return; }
    tmp.position.set(x, y, z);
    tmp.rotation.set(0, rotY, 0);
    tmp.scale.set(s, sy ?? s, s);
    tmp.updateMatrix();
    (placements[name] ||= []).push(tmp.matrix.clone());
  }

  // ---- floor of the three lanes + courtyard ----
  for (let z = LANE_END_Z; z > LANE_START_Z - 8; z -= 4) {
    for (const x of LANES) {
      const v = r();
      place(v < 0.12 ? 'floor_tile_large_rocks' : 'floor_tile_large', x, 0.05, z - 2, Math.floor(r() * 4) * Math.PI / 2);
    }
  }
  // courtyard (player area) – 4 tiles wide each side
  for (let z = LANE_END_Z + 4; z <= 10; z += 4) {
    for (let x = -10; x <= 10; x += 4) {
      place(r() < 0.1 ? 'floor_tile_large_rocks' : 'floor_tile_large', x, 0.05, z - 2, Math.floor(r() * 4) * Math.PI / 2);
    }
  }

  // ---- lane dividers: low barriers between lanes, walls on the outside ----
  for (let z = LANE_END_Z - 2; z > LANE_START_Z; z -= 4) {
    for (const x of [-LANE_W * 1.5, LANE_W * 1.5]) {
      place('wall', x, 0, z, Math.PI / 2, 1, 0.55);
    }
    for (const x of [-LANE_W / 2, LANE_W / 2]) {
      place('barrier', x, 0.05, z, Math.PI / 2, 1, 0.9);
    }
  }
  // pillars at lane mouths
  for (const x of [-LANE_W * 1.5, -LANE_W / 2, LANE_W / 2, LANE_W * 1.5]) place('pillar', x, 0, LANE_END_Z, 0, 0.55, 0.6);
  for (const x of [-LANE_W * 1.5, LANE_W * 1.5]) {
    place('banner_patternA_red', x, 1.4, LANE_END_Z - 0.9, Math.PI, 0.7);
  }
  // torches on outer walls
  const torches = [];
  for (let z = LANE_END_Z - 6; z > LANE_START_Z + 10; z -= 12) {
    for (const x of [-LANE_W * 1.5 - 0.6, LANE_W * 1.5 + 0.6]) { place('torch_lit', x, 2.0, z, 0, 0.9); torches.push(new THREE.Vector3(x, 2.6, z)); }
  }

  // ---- courtyard edges ----
  for (let z = -2; z <= 10; z += 4) {
    place('wall_half', -12.2, 0, z, Math.PI / 2, 1, 0.45);
    place('wall_half', 12.2, 0, z - 2, -Math.PI / 2, 1, 0.45);
  }
  place('barrel_large', -10.3, 0, 1.5, 0, 0.6); place('crates_stacked', -10.5, 0, 4.8, 0.4, 0.7);
  place('box_large', 10.4, 0, 2.2, 0.3, 0.7); place('barrel_large', 10.2, 0, 5.5, 0, 0.6);
  place('sword_shield_broken', 9.6, 0.6, -2.4, 0.5, 0.7);

  // ---- surroundings: graveyard left, ruins right ----
  function scatterSide(side) {
    const sx = side;
    for (let z = 4; z > -110; z -= 3.2) {
      const xNear = sx * (LANE_W * 1.5 + 2.5 + r() * 2);
      const xFar = sx * (LANE_W * 1.5 + 7 + r() * 8);
      const v = r();
      if (side < 0) {
        if (v < 0.35) place(['grave_A', 'grave_B', 'gravestone', 'grave_A_destroyed'][Math.floor(r() * 4)], xNear, 0, z, (r() - 0.5) * 0.5 + Math.PI * 0.5 * sx, 0.7);
        else if (v < 0.5) place(['gravemarker_A', 'gravemarker_B'][Math.floor(r() * 2)], xNear, 0, z, (r() - 0.5) * 0.8, 0.8);
        else if (v < 0.62) place('tree_dead_large', xFar, 0, z, r() * 6, 0.9 + r() * 0.5);
        else if (v < 0.72) place('tree_pine_orange_large', xFar - 3, 0, z, r() * 6, 0.8 + r() * 0.4);
        else if (v < 0.8) place('post_lantern', xNear + sx * 0.5, 0, z, Math.PI / 2, 0.8);
        if (r() < 0.45) place(['skull', 'ribcage', 'bone_A', 'bone_B'][Math.floor(r() * 4)], xNear + sx * (1 + r() * 3), 0.05, z + r() * 2, r() * 6, 0.8);
      } else {
        if (v < 0.3) place(['wall_broken', 'wall_cracked', 'wall'][Math.floor(r() * 3)], xNear + sx * 1.5, 0, z, Math.PI / 2 + (r() - 0.5) * 0.3, 0.8, 0.5 + r() * 0.5);
        else if (v < 0.45) place('rubble_large', xFar, 0, z, r() * 6, 0.7 + r() * 0.3);
        else if (v < 0.55) place('rubble_half', xNear + sx * 2, 0, z, r() * 6, 0.6);
        else if (v < 0.65) place('tree_dead_medium', xFar + 2, 0, z, r() * 6, 1.1);
        else if (v < 0.72) place(['barrel_large', 'crates_stacked', 'box_large'][Math.floor(r() * 3)], xNear + sx, 0, z, r() * 6, 0.65);
        if (r() < 0.3) place('pillar', xNear + sx * (3 + r() * 4), 0, z, 0, 0.6, 0.3 + r() * 0.9);
      }
    }
  }
  scatterSide(-1);
  scatterSide(1);

  // fence along the graveyard
  for (let z = 2; z > -100; z -= 4) {
    place(r() < 0.25 ? 'fence_broken' : 'fence', -LANE_W * 1.5 - 1.4, 0, z, Math.PI / 2, 0.8);
    place(r() < 0.3 ? 'fence_pillar_broken' : 'fence_pillar', -LANE_W * 1.5 - 1.4, 0, z + 2, 0, 0.8);
  }
  // landmarks
  place('crypt', -26, 0, -40, Math.PI / 2, 1.1);
  place('arch_gate', -LANE_W * 1.5 - 1.4, 0, -22, Math.PI / 2, 0.9);
  place('building_tower_A_blue', 20, 0, -12, -0.4, 6);
  place('building_tower_catapult_blue', 22, 0, -52, 0.6, 6);
  place('building_destroyed', 26, 0, -30, 0.3, 9);
  place('building_destroyed', 30, 0, -75, 1.3, 10);
  place('tree_pine_orange_large', -18, 0, 6, 0.3, 1.2);
  place('tree_dead_large', 16, 0, 7, 1, 1.4);
  // autumn forest backdrop (closes the horizon)
  const trees = ['tree_pine_orange_large', 'tree_pine_yellow_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium', 'tree_dead_large'];
  for (let row = 0; row < 4; row++) {
    for (let x = -70; x <= 70; x += 4.5 + r() * 3) {
      if (Math.abs(x) < 9 && row < 2) continue;
      place(trees[Math.floor(r() * (row < 2 ? 5 : 4))], x + r() * 2, 0, -96 - row * 7 - r() * 4, r() * 6, 1.4 + r() * 0.9 + row * 0.25);
    }
  }
  // side forests
  for (const side of [-1, 1]) {
    for (let z = 12; z > -96; z -= 4 + r() * 3) {
      place(trees[Math.floor(r() * 4)], side * (30 + r() * 14), 0, z, r() * 6, 1.4 + r() * 0.8);
      if (r() < 0.6) place(trees[Math.floor(r() * 5)], side * (46 + r() * 16), 0, z - 2, r() * 6, 1.6 + r() * 0.8);
    }
  }

  // ---- build instanced meshes ----
  const group = new THREE.Group();
  for (const [name, mats] of Object.entries(placements)) {
    for (const part of lib[name]) {
      let material = part.material;
      if (/^floor_tile/.test(name)) { material = material.clone(); material.color = new THREE.Color(0.6, 0.57, 0.53); }
      if (/^(wall|pillar|barrier)/.test(name)) { material = material.clone(); material.color = new THREE.Color(0.82, 0.8, 0.78); }
      const im = new THREE.InstancedMesh(part.geometry, material, mats.length);
      const m = new THREE.Matrix4();
      mats.forEach((M, i) => im.setMatrixAt(i, m.multiplyMatrices(M, part.matrix)));
      im.castShadow = true;
      im.receiveShadow = true;
      // shadows are re-rendered every frame now (animated units), so only pieces near the playfield cast them
      if (/mountain|hills|tree|building|crypt|floor_tile/.test(name)) { im.castShadow = false; }
      group.add(im);
    }
  }
  scene.add(group);

  // ---- ground plane under everything ----
  const groundTex = makeGroundTexture();
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(30, 30);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: 0xb8a98c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -60);
  ground.receiveShadow = true;
  scene.add(ground);

  return { torches };
}

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8f8a6a';
  g.fillRect(0, 0, 256, 256);
  const r = rng(3);
  for (let i = 0; i < 2200; i++) {
    const x = r() * 256, y = r() * 256, s = 1 + r() * 5;
    const t = r();
    g.fillStyle = t < 0.4 ? 'rgba(70,90,45,0.35)' : t < 0.7 ? 'rgba(120,105,80,0.35)' : 'rgba(60,55,45,0.3)';
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function makeSky(scene) {
  const geo = new THREE.SphereGeometry(500, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f62b8) },
      mid: { value: new THREE.Color(0x8fb5de) },
      bottom: { value: new THREE.Color(0xe9cfa6) },
    },
    vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vW;
      void main(){ float h = vW.y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.55, h)) : mix(bottom, mid, smoothstep(-0.05, 0.08, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}
