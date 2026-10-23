const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { audit } = require('./audit_lyric_coverage.cjs');

test('coverage records Joshua approval for the synchronized BTS release', () => {
  const rows = audit();
  for (const title of ['Butter', 'Dynamite']) {
    const row = rows.find(row => row.recording === `songs/BTS - ${title}.m4a`);
    assert.ok(row);
    assert.equal(row.status, 'approved');
    assert.deepEqual(row.missing, []);
  }
});

test('all expressly deferred songs are excluded from this synchronization task', () => {
  for (const row of audit().filter(row => /Machine Love|Science \(English\)|Campus Village - Teto|Fever Dream/.test(row.recording))) assert.equal(row.status,'excluded');
});

test('Ochame Kinou is excluded at the user request, not marked complete', () => {
  const rows = audit().filter(row => /Ochame Kinou/.test(row.recording));
  assert.equal(rows.length, 6);
  for (const row of rows) assert.equal(row.status, 'excluded');
});

test('Japanese Window View has a companion translation for every existing timed line', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../songs/lyrics/window-view-jp.json')));
  assert.equal(data.translations.length, data.lines.length);
  for (const entry of data.translations) {
    assert.ok(entry.romaji.trim()); assert.ok(entry.en.trim());
    assert.ok(!/[\u3040-\u30ff\u4e00-\u9fff]/u.test(entry.romaji));
  }
  assert.equal(audit().find(row => row.recording.includes('Farewell225')).status, 'approved');
});

test('all three established parallel Japanese songs retain complete language coverage', () => {
  for (const fragment of ['Trick Heart.m4a', 'Magic Maid.m4a', 'MIMI - Encore Dance (Japanese)']) {
    const rows = audit().filter(row => row.recording.includes(fragment));
    assert.equal(rows.length, 1); assert.equal(rows[0].status, 'text-complete');
  }
});
