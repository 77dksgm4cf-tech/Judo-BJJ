// Erzeugt public/data/techniques.js und public/data/trainingsplan.js
// aus scripts/kyu-data.js (als Skripte statt JSON, damit die App auch per
// Doppelklick unter file:// ohne fetch() funktioniert). Einmal ausführen: npm run generate-static-data
// Enthält keine Personendaten.

const fs = require('fs');
const path = require('path');
const { KYU, PLAN_BLOCKS, PHASES, GAMES } = require('./kyu-data');

const OUT_DIR = path.join(__dirname, '..', 'public', 'data');

function slug(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

const techniques = [];
const seen = new Set();
for (const k of KYU) {
  for (const [category, name, label] of k.items) {
    let id = `k${k.kyu}_${slug(category)}_${slug(name)}`;
    let n = 2;
    while (seen.has(id)) id = `k${k.kyu}_${slug(category)}_${slug(name)}_${n++}`;
    seen.add(id);
    techniques.push({ id, name, label, category, guertel: k.guertel, kyu: k.kyu });
  }
}

const plan = {};
for (const k of KYU) {
  const def = PLAN_BLOCKS[k.kyu];
  const perBlock = def.weeks || 4;
  const rows = [];
  let week = 1;
  def.blocks.forEach((block) => {
    for (let i = 0; i < perBlock; i++) {
      const phases = PHASES[block.type];
      const games = GAMES[block.type];
      rows.push({
        woche: week++,
        schwerpunkt: block.title,
        technik: block.technik,
        anwendung: perBlock === 1 ? phases[0] : phases[i % phases.length],
        spiel: games[i % games.length],
      });
    }
  });
  plan[k.guertel] = rows;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const HEADER = '// Automatisch erzeugt (npm run generate-static-data)\n';
fs.writeFileSync(path.join(OUT_DIR, 'techniques.js'), HEADER + 'window.JUDO_TECHNIQUES = ' + JSON.stringify(techniques, null, 1) + ';\n');
fs.writeFileSync(path.join(OUT_DIR, 'trainingsplan.js'), HEADER + 'window.JUDO_TRAININGSPLAN = ' + JSON.stringify(plan, null, 1) + ';\n');
for (const old of ['techniques.json', 'trainingsplan.json']) fs.rmSync(path.join(OUT_DIR, old), { force: true });

console.log(`${techniques.length} Techniken, Trainingsplan für ${Object.keys(plan).length} Kyu-Grade geschrieben.`);
for (const k of KYU) {
  console.log(`  ${k.kyu}. Kyu (${k.guertel}): ${techniques.filter((t) => t.kyu === k.kyu).length} Einträge, ${plan[k.guertel].length} Wochen`);
}
