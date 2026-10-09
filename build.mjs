import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist/assets', { recursive: true });
await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', target: 'es2022', minify: true, outfile: 'dist/game.js', alias: { 'three/addons': './node_modules/three/examples/jsm' } });
// index.html holds only the page body; wrap it in a full document for standalone hosting (GitHub Pages)
const page = fs.readFileSync('index.html', 'utf8');
fs.writeFileSync('dist/index.html', `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#2f62b8">
</head>
<body>
${page}
</body>
</html>
`);
// artifacts don't serve .glb, so ship each model as self-contained glTF JSON (buffers/images as data URIs)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of fs.readdirSync('public/assets').filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read('public/assets/' + f);
  const { json, resources } = await io.writeJSON(doc, { format: 'gltf' });
  const embed = (uri, mime) => `data:${mime};base64,${Buffer.from(resources[uri]).toString('base64')}`;
  for (const b of json.buffers || []) if (b.uri) b.uri = embed(b.uri, 'application/octet-stream');
  for (const im of json.images || []) if (im.uri) { im.uri = embed(im.uri, im.mimeType || 'image/png'); }
  const out = 'dist/assets/' + f.replace('.glb', '.json');
  fs.writeFileSync(out, JSON.stringify(json));
  console.log(out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
}
// sound effects (rendered by tools/make-sounds.py)
fs.cpSync('public/sounds', 'dist/sounds', { recursive: true });
console.log('built', (fs.statSync('dist/game.js').size / 1024).toFixed(0), 'KB');
