// Keep the recording audit in lockstep with the player's existing registry.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const declaration = 'const SUPPORTED_LYRIC_TRACKS = ';
const begin = source.indexOf(declaration);
assert.ok(begin >= 0, 'player registry declaration exists');
const end = source.indexOf('\n};', begin);
assert.ok(end > begin, 'player registry declaration is complete');
const registry = vm.runInNewContext('(' + source.slice(begin + declaration.length, end + 2) + ')', {}, { timeout: 1000 });
const tracks = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-B', '-c',
  'import ast,json,sys; t=ast.parse(open(sys.argv[1]).read()); print(json.dumps(next(ast.literal_eval(n.value) for n in t.body if isinstance(n,ast.Assign) and any(isinstance(a,ast.Name) and a.id=="TRACKS" for a in n.targets))))',
  path.join(__dirname, 'audit_lyrics.py')], { encoding: 'utf8' }));
const normalized = value => value.normalize('NFC').replace(/\.(m4a|mp3)$/i, '').toLowerCase();
const expected = new Set();
let metadataOnly = 0;
for (const [song, config] of Object.entries(registry)) {
  // This instrumental rendition borrows sections, not sung lyrics.
  if (config.scene === 'encore-harp') { metadataOnly++; continue; }
  const data = JSON.parse(fs.readFileSync(path.resolve(root, config.dataUrl), 'utf8'));
  const variant = data.variants ? config.variant : 'base';
  assert.ok(!data.variants || data.variants[variant], song + ': unknown lyric variant');
  const identity = JSON.stringify([path.basename(config.dataUrl), variant, normalized(song)]);
  expected.add(identity);
}
const actual = new Set(tracks.map(([file, variant, audio]) => JSON.stringify([file, variant, normalized(audio)])));
assert.deepEqual([...actual].sort(), [...expected].sort(), 'audit must cover every lyric-bearing player recording');
console.log(`Player registry coverage passed: ${expected.size} lyric recordings; ${metadataOnly} explicit instrumental configuration.`);
