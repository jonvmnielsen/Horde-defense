import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  const tris = r.listMeshes().reduce((a,m)=>a+m.listPrimitives().reduce((b,p)=>b+(p.getIndices()?p.getIndices().getCount()/3:0),0),0);
  console.log(f.split('/').pop(), 'meshes',r.listMeshes().length,'tris',tris,'skins',r.listSkins().length,'mats',r.listMaterials().length,'tex',r.listTextures().length,'anims',r.listAnimations().length);
  console.log('  ', r.listAnimations().map(a=>a.getName()).join(', ').slice(0,900));
}
