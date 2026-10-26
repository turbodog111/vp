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
  const preparedPath = path.join(root, 'songs/lyrics/drafts/manifest.json');
  const prepared = fs.existsSync(preparedPath) ? JSON.parse(fs.readFileSync(preparedPath, 'utf8')) : [];
  const alignedPath = path.join(root, 'songs/lyrics/aligned/manifest.json');
  const aligned = fs.existsSync(alignedPath) ? JSON.parse(fs.readFileSync(alignedPath, 'utf8')) : [];
  const family = /\bbts\b|kasane|mimi|milisen|machine love|ochame|science|encore dance|window view|trick heart|magic maid| - teto\./i;
  const instrumental = /piano|instrumental|\(drums|strings.*harp|bright keys/i;
  return catalog.filter(song => family.test(song.name)).map(song => {
    const recording = `songs/${song.name}`;
    if (/Ochame Kinou|Machine Love|Science \(English\)|Campus Village - Teto|Fever Dream/i.test(song.name)) return { recording, status: 'excluded', missing: [], note: 'Joshua excluded this recording from the current lyric synchronization task on 2026-10-22.' };
    if (/instrumental/i.test(song.name)) return { recording, status: 'instrumental', missing: [] };
    if (instrumental.test(song.name)) return { recording, status: 'vocal-review', missing: ['Confirm whether this rendition retains sung backing vocals.'] };
    const config = registry[normalize(recording)];
    const english = /^BTS - |\(English(?: Language)?\)|^hololive English|Machine Love|One More Bite|Waiting for Tomorrow|Ever Romantic/i.test(song.name);
    const japanese = (/MIMI|Ochame Kinou|^Farewell225 - Window View/i.test(song.name) || config?.variant === 'jp') && !english;
    const required = japanese ? ['romaji', 'en'] : english ? ['en'] : ['source-language review', 'en'];
    const packet = prepared.find(entry => entry.recording === recording);
    const candidate = aligned.find(entry => entry.recording === recording);
    if (candidate) {
      const data = JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/aligned', candidate.file), 'utf8'));
      const approved = candidate.status === 'approved' && data.alignment?.approved === true
        && data.alignment.audioSha256 === candidate.audioSha256;
      return { recording, status: approved ? 'approved' : 'local-review', missing: approved ? [] : ['Local listening review and Joshua approval before publication.'], lines: candidate.lines, source: './songs/lyrics/aligned/' + candidate.file };
    }
    if (!config && packet) return { recording, status: 'text-ready', missing: ['Recording-specific start/end and word alignment; source review where flagged.'], lines: packet.lines, source: './songs/lyrics/drafts/' + packet.file, note: packet.note };
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
    return { recording, status: missing.length ? 'incomplete' : data.alignment?.approved === true ? 'approved' : data.alignment?.status === 'local-review' ? 'local-review' : 'text-complete', missing,
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
    'Text-ready drafts contain user-supplied words but do not have verified timing. Ochame Kinou is excluded at user request.',
    'Local-review means acoustic timing candidates are available on localhost; it does not mean listening approval or publication.',
    'Approved means Joshua accepted the recording-specific lyric presentation for publication; it is not a claim of sample-perfect acoustic timing.',
    '',
    `Summary: ${JSON.stringify(counts)}`,
    '',
    ...rows.map((row, i) => `${i + 1}. [${row.status}] ${row.recording}\n   ${row.missing.length ? 'Needs: ' + row.missing.join(', ') : row.status === 'instrumental' ? 'No sung-lyric requirement.' : row.status === 'excluded' ? row.note : `${row.lines} timed lines; ${row.source}`}`),
    ''
  ].join('\n');
}

if (require.main === module) {
  const rows = audit();
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(rows, null, 2) + '\n' : report(rows));
  if (process.argv.includes('--check') && rows.some(row => ['missing', 'incomplete', 'vocal-review', 'text-ready', 'local-review'].includes(row.status))) process.exitCode = 1;
}
module.exports = { audit, report };
