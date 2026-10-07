import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const s = doc.getRoot().listScenes()[0];
for (const n of s.listChildren()) { const b = getBounds(n); const f=v=>v.map(x=>x.toFixed(2)).join(','); console.log(n.getName().padEnd(28), 'min', f(b.min), 'max', f(b.max)); }
