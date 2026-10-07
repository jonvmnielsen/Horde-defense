import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  console.log('==', f.split('/').pop());
  for (const n of r.listNodes()) if (n.getMesh()) { const p=n.getMesh().listPrimitives()[0]; console.log('  ', n.getName(), 'skin:', !!n.getSkin(), 'verts', p.getAttribute('POSITION').getCount(), 'parent', n.listParents().map(x=>x.getName?.()).join('/')); }
  const a = r.listAnimations(); console.log('  anims:', a.map(x=>x.getName()+':'+x.listSamplers().reduce((m,s)=>Math.max(m,s.getInput().getMax([])[0]),0).toFixed(2)).filter(s=>/Run|Death|Shoot|Idle|Walk|Cheer|Spawn|Hit|Attack_Chop/.test(s)).join(' '));
}
