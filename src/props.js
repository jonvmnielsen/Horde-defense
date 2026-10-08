// Instanced copies of a static model (a chest, a crate, a gate): one InstancedMesh per part of the model.
import * as THREE from 'three';

const _m = new THREE.Matrix4();

export class PropSet {
  /**
   * template: an Object3D (e.g. a node from env.glb)
   * opts.tint: [r,g,b] multiplied into every material; opts.emissive: [r,g,b] glow; opts.shadow: cast shadows
   */
  constructor(scene, template, max, opts = {}) {
    template.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(template.matrixWorld).invert();
    this.parts = [];
    this.max = max;
    this.n = 0;
    const box = new THREE.Box3();
    template.traverse((o) => {
      if (!o.isMesh) return;
      const mat = o.material.clone();
      if (opts.tint) mat.color.multiply(new THREE.Color(...opts.tint));
      if (opts.emissive) { mat.emissive = new THREE.Color(...opts.emissive); mat.emissiveIntensity = 1; }
      if (opts.roughness !== undefined) mat.roughness = opts.roughness;
      if (opts.metalness !== undefined) mat.metalness = opts.metalness;
      const im = new THREE.InstancedMesh(o.geometry, mat, max);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
      im.castShadow = opts.shadow !== false;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      scene.add(im);
      const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      this.parts.push({ im, local });
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(local));
    });
    this.size = box.getSize(new THREE.Vector3());
    this.min = box.min.clone();
    this.center = box.getCenter(new THREE.Vector3());
  }
  begin() { this.n = 0; }
  /** matrix: world transform of this copy; bright: >1 flashes it */
  add(matrix, bright = 1) {
    if (this.n >= this.max) return;
    for (const p of this.parts) {
      p.im.setMatrixAt(this.n, _m.multiplyMatrices(matrix, p.local));
      p.im.instanceColor.setXYZ(this.n, bright, bright, bright);
    }
    this.n++;
  }
  end() {
    for (const p of this.parts) {
      p.im.count = this.n;
      p.im.instanceMatrix.needsUpdate = true;
      p.im.instanceColor.needsUpdate = true;
    }
  }
}
