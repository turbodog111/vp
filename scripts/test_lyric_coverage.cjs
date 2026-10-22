const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { audit } = require('./audit_lyric_coverage.cjs');

test('coverage reports missing BTS lyrics honestly instead of certifying graphics as lyrics', () => {
  const rows = audit();
  for (const title of ['Butter', 'Dynamite']) {
    const row = rows.find(row => row.recording === `songs/BTS - ${title}.m4a`);
    assert.ok(row);
    assert.equal(row.status, 'missing');
    assert.deepEqual(row.missing, ['en']);
  }
});

test('Japanese Window View has a companion translation for every existing timed line', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../songs/lyrics/window-view-jp.json')));
  assert.equal(data.translations.length, data.lines.length);
  for (const entry of data.translations) {
    assert.ok(entry.romaji.trim()); assert.ok(entry.en.trim());
    assert.ok(!/[\u3040-\u30ff\u4e00-\u9fff]/u.test(entry.romaji));
  }
  assert.equal(audit().find(row => row.recording.includes('Farewell225')).status, 'text-complete');
});

test('all three established parallel Japanese songs retain complete language coverage', () => {
  for (const fragment of ['Trick Heart.m4a', 'Magic Maid.m4a', 'MIMI - Encore Dance (Japanese)']) {
    const rows = audit().filter(row => row.recording.includes(fragment));
    assert.equal(rows.length, 1); assert.equal(rows[0].status, 'text-complete');
  }
});
