#!/usr/bin/env node
/*
 * build-onelinefont.js
 * ────────────────────
 * Bouwt assets/onelinefont.js met de volledige one-line-font ingesloten
 * (bestandsnaam + SVG-tekst per teken). De app laadt dit via een
 * <script>-tag, zodat "Tekst als pad" werkt in de desktop-app (file://),
 * online én op elke andere computer — zonder fetch.
 *
 * De lo/ro/s/f-metadata van elk teken zit in de BESTANDSNAAM; die wordt
 * dus ongewijzigd meegenomen. Voeg je een teken toe of pas je de metadata
 * aan, draai dan opnieuw:  npm run build:font
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'onelinefont');

if (!fs.existsSync(DIR)) {
  console.error('Map niet gevonden:', DIR);
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.svg')).sort();
const data = files.map(f => ({ file: f, svg: fs.readFileSync(path.join(DIR, f), 'utf8').trim() }));

const js = '/* Automatisch gegenereerd door tools/build-onelinefont.js — niet handmatig bewerken. */\n'
  + 'window.ONE_LINE_FONT_DATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(ROOT, 'assets', 'onelinefont.js'), js, 'utf8');

console.log(`One Line Font gebouwd: ${data.length} tekens → assets/onelinefont.js`);
