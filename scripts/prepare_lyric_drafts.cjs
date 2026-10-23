// Materializes user-supplied text and authored translations. No timing is inferred.
const fs = require('node:fs');
const path = require('node:path');
const { fresh, decode } = require('../lyric-workbench.js');
const folder = path.resolve(__dirname, '../songs/lyrics/drafts');
const packets = JSON.parse(fs.readFileSync(path.join(folder, 'text-sources.json'), 'utf8'));
const manifest = packets.map(packet => {
  const draft = fresh(packet.recording, packet.language);
  draft.source = 'Text supplied by Joshua on 2026-10-22. ' + packet.note;
  draft.rows = packet.lines.map((parts, i) => {
    const row = { id: `line-${i + 1}`, start: null, end: null, words: {}, ja: '', romaji: '', en: '', zh: '', pinyin: '' };
    packet.columns.forEach((language, j) => { row[language] = parts[j] || ''; });
    return row;
  });
  decode(draft, packet.recording);
  const file = packet.id + '.json';
  fs.writeFileSync(path.join(folder, file), JSON.stringify(draft, null, 2) + '\n');
  return { recording: packet.recording, file, lines: draft.rows.length, status: 'text-ready-timing-unassigned', note: packet.note };
});
fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest.map(p => `${p.file}: ${p.lines} lines, no invented timestamps`).join('\n'));
