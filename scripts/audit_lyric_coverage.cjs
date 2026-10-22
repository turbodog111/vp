// Presence audit only: never treats another rendition's timeline as interchangeable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const normalize = value => value.normalize('NFC').replace(/\.(m4a|mp3)$/i, '').toLowerCase();

function audit() {
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const marker = 'const SUPPORTED_LYRIC_TRACKS = ';
  const start = source.indexOf(marker) + marker.length;
  const registry = vm.runInNewContext('(' + source.slice(start, source.indexOf('\n};', start) + 2) + ')');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'songs/manifest.json')));
  const family = /\bbts\b|kasane|mimi|milisen|machine love|ochame|science|encore dance|window view|trick heart|magic maid| - teto\./i;
  const instrumental = /piano|instrumental|\(drums|strings.*harp|bright keys/i;
  return catalog.filter(song => family.test(song.name)).map(song => {
    const recording = `songs/${song.name}`;
    if (/instrumental/i.test(song.name)) return { recording, status: 'instrumental', missing: [] };
    if (instrumental.test(song.name)) return { recording, status: 'vocal-review', missing: ['Confirm whether this rendition retains sung backing vocals.'] };
    const english = /^BTS - |\(English(?: Language)?\)|^hololive English|Machine Love|One More Bite|Waiting for Tomorrow|Ever Romantic/i.test(song.name);
    const japanese = /MIMI|Ochame Kinou|^Farewell225 - Window View/i.test(song.name) && !english;
    const required = japanese ? ['romaji', 'en'] : english ? ['en'] : ['source-language review', 'en'];
    const config = registry[normalize(recording)];
    if (!config) return { recording, status: 'missing', missing: required, note: 'No recording-specific lyric timeline.' };
    const data = JSON.parse(fs.readFileSync(path.resolve(root, config.dataUrl), 'utf8'));
    const lines = data.variants ? data.variants[config.variant]?.lines : data.lines;
    const has = language => lines?.length > 0 && lines.every((line, index) => {
      const value = line[language] || data.translations?.[index]?.[language];
      if (Array.isArray(value)) return value.some(text => typeof text === 'string' && text.trim());
      if (typeof value === 'string' && value.trim()) return true;
      return language === 'en' && english && typeof line.text === 'string' && line.text.trim();
    });
    const missing = required.filter(language => !has(language));
    return { recording, status: missing.length ? 'incomplete' : 'text-complete', missing,
      lines: lines?.length || 0, source: config.dataUrl };
  });
}

function report(rows) {
  const counts = rows.reduce((all, row) => { all[row.status] = (all[row.status] || 0) + 1; return all; }, {});
  return [
    'VP VOCALOID-RELATED / BTS LYRIC COVERAGE',
    'Includes named Vocaloid-related songs and their covers. Explicit instrumental tracks are exempt; piano/drum covers require a vocal-presence check.',
    'English-language recordings require English, not artificial Japanese or romaji.',
    'Text-complete means required language text exists on every line. It does NOT certify acoustic timing.',
    'Missing words/translations need user-provided or appropriately licensed source material.',
    '',
    `Summary: ${JSON.stringify(counts)}`,
    '',
    ...rows.map((row, i) => `${i + 1}. [${row.status}] ${row.recording}\n   ${row.missing.length ? 'Needs: ' + row.missing.join(', ') : row.status === 'instrumental' ? 'No sung-lyric requirement.' : `${row.lines} timed lines; ${row.source}`}`),
    ''
  ].join('\n');
}

if (require.main === module) {
  const rows = audit();
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(rows, null, 2) + '\n' : report(rows));
  if (process.argv.includes('--check') && rows.some(row => ['missing', 'incomplete', 'vocal-review'].includes(row.status))) process.exitCode = 1;
}
module.exports = { audit, report };
