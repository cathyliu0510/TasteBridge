import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

for (const route of ['dist/index.html', 'dist/a/index.html', 'dist/b/index.html', 'dist/project/index.html']) {
  const html = readFileSync(route, 'utf8');
  for (const [, attributes, code] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attributes.includes('application/json')) JSON.parse(code);
    else new Script(code, { filename: route });
  }
  if (html.includes('127.0.0.1') || html.includes('href="TasteBridge-Prototype-')) {
    throw new Error(`Unadapted local navigation in ${route}`);
  }
  if (/FONT_GEIST|FONT_SERIF|COVER_MISTBORN|COVER_LOCKE|COVER_GONE_GIRL/.test(html)) throw new Error(`Unresolved project asset in ${route}`);
  if (!html.includes('data:image/svg+xml')) throw new Error(`Missing favicon in ${route}`);
  console.log(`${route}: inline JavaScript, metadata, and hosted navigation verified`);
}
if (!readFileSync('dist/index.html').equals(readFileSync('dist/a/index.html'))) {
  throw new Error('The main route must match version A');
}
