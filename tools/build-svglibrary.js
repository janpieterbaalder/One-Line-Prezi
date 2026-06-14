#!/usr/bin/env node
/*
 * build-svglibrary.js
 * ───────────────────
 * Bouwt de ingebouwde one-line-art SVG-bibliotheek.
 *
 * 1. (optioneel) Kopieert SVG's uit een bronmap naar assets/svglibrary/
 *    met opgeschoonde, web-veilige bestandsnamen.
 * 2. Scant assets/svglibrary/ en genereert:
 *      - assets/svglibrary.js        (window.SVG_LIBRARY met ingesloten SVG-tekst)
 *      - assets/svglibrary/manifest.json
 *
 * De app laadt assets/svglibrary.js via een <script>-tag, zodat de
 * bibliotheek werkt in de desktop-app (file://), online (http) én op
 * elke andere computer — zonder fetch en zonder de losse bestanden.
 *
 * Gebruik:
 *   node tools/build-svglibrary.js                 # (her)genereer uit assets/svglibrary
 *   node tools/build-svglibrary.js --from "one line art svg"   # importeer + genereer
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIBDIR = path.join(ROOT, 'assets', 'svglibrary');

const fromIdx = process.argv.indexOf('--from');
const SRC = fromIdx !== -1 && process.argv[fromIdx + 1]
  ? path.resolve(ROOT, process.argv[fromIdx + 1])
  : LIBDIR;

fs.mkdirSync(LIBDIR, { recursive: true });

function slug(base) {
  return base
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accenten weg
    .replace(/['‘’]/g, '')                  // apostrofs weg
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function displayName(base) {
  // strip een afsluitend nummer dat met een scheidingsteken begint (-01, _01, 01-01)
  let n = base.replace(/[-_ ]+\d+(?:[-_ ]\d+)*$/, '');
  n = n.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) n = base;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// bewaar bestaande (eventueel handmatig aangepaste) namen uit de manifest
const existingNames = {};
const manifestPath = path.join(LIBDIR, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    JSON.parse(fs.readFileSync(manifestPath, 'utf8')).forEach(e => { if (e && e.file) existingNames[e.file] = e.name; });
  } catch (e) { /* corrupte manifest: negeren */ }
}

// ── 1. importeren uit bronmap ────────────────────────────────
const importedNames = {};
if (path.resolve(SRC) !== path.resolve(LIBDIR)) {
  if (!fs.existsSync(SRC)) {
    console.error('Bronmap niet gevonden:', SRC);
    process.exit(1);
  }
  const srcFiles = fs.readdirSync(SRC).filter(f => f.toLowerCase().endsWith('.svg'));
  const used = new Set();
  for (const f of srcFiles) {
    const base = f.replace(/\.svg$/i, '');
    let s = slug(base) || 'art';
    let dest = s, i = 2;
    while (used.has(dest)) dest = s + '-' + (i++);
    used.add(dest);
    fs.copyFileSync(path.join(SRC, f), path.join(LIBDIR, dest + '.svg'));
    importedNames[dest + '.svg'] = displayName(base); // afgeleid van originele naam (behoudt hoofdletters)
  }
  console.log(`Geïmporteerd: ${srcFiles.length} SVG(s) uit "${path.relative(ROOT, SRC)}"`);
}

// ── 2. bibliotheek genereren ─────────────────────────────────
const files = fs.readdirSync(LIBDIR).filter(f => f.toLowerCase().endsWith('.svg')).sort();
const lib = files.map(f => {
  const base = f.replace(/\.svg$/i, '');
  const name = importedNames[f] || existingNames[f] || displayName(base);
  return { name, file: f, svg: fs.readFileSync(path.join(LIBDIR, f), 'utf8').trim() };
});
lib.sort((a, b) => a.name.localeCompare(b.name, 'nl'));

const js = '/* Automatisch gegenereerd door tools/build-svglibrary.js — niet handmatig bewerken. */\n'
  + 'window.SVG_LIBRARY = ' + JSON.stringify(lib) + ';\n';
fs.writeFileSync(path.join(ROOT, 'assets', 'svglibrary.js'), js, 'utf8');

const manifest = lib.map(({ name, file }) => ({ name, file }));
fs.writeFileSync(path.join(LIBDIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Bibliotheek gebouwd: ${lib.length} afbeeldingen → assets/svglibrary.js`);
lib.forEach(it => console.log('  •', it.name, '(' + it.file + ')'));
