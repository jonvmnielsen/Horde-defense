import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); const r = doc.getRoot();
let tot = {};
for (const a of r.listAccessors()) { const k = a.listParents().map(p=>p.propertyType).filter(t=>t!=='Root').join('|'); tot[k]=(tot[k]||0)+a.getByteLength(); }
console.log(tot);
console.log('images', r.listTextures().map(t=>t.getImage()?.byteLength));
console.log('anim samplers', r.listAnimations().map(a=>a.getName()+':'+a.listChannels().length));
