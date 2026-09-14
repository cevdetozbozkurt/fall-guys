import fs from 'node:fs';
import crypto from 'node:crypto';
const files = fs
  .readdirSync('web-dist/assets')
  .filter((name) => !name.endsWith('.map'))
  .map((name) => './assets/' + name);
const version = crypto
  .createHash('sha256')
  .update(files.join('|'))
  .digest('hex')
  .slice(0, 12);
let source = fs.readFileSync('public/sw.js', 'utf8');
source = source.replace(
  "'tumble-club-v4'",
  JSON.stringify('tumble-club-' + version),
);
source = source.replace(
  /const PRECACHE = \[[\s\S]*?\];/,
  'const PRECACHE = ' +
    JSON.stringify([
      './',
      './manifest.webmanifest',
      './icon-192.png',
      './icon-512.png',
      './cosmos.webp',
      './flags/tr.svg',
      './flags/gb.svg',
      './flags/fr.svg',
      './flags/de.svg',
      ...files,
    ]) +
    ';',
);
fs.writeFileSync('web-dist/sw.js', source);
console.log('Installable game package prepared.');
