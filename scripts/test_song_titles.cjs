// Every recording shows its song title first and its artists second: no artist name,
// featured-singer credit or upload tag (such as "piano - ") may sit in the title.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function extract(name) {
  const match = new RegExp('^( *)function ' + name + '\\(', 'm').exec(APP);
  assert.ok(match, 'production function exists: ' + name);
  const end = APP.indexOf('\n' + match[1] + '}\n', match.index);
  return APP.slice(match.index, end + match[1].length + 2);
}

function constant(name, closer) {
  const start = APP.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `production constant exists: ${name}`);
  return APP.slice(start, APP.indexOf(closer, start) + closer.length);
}

const c = vm.createContext({ AUDIO_EXTENSION_RE: /\.(mp3|m4a)$/i });
vm.runInContext([
  constant('PDOOM_AUDIO_PATH', ';\n'),
  constant('PBLOOM_AUDIO_PATH', ';\n'),
  constant('HIT_BREAKS_AUDIO_PATH', ';\n'),
  constant('SONG_METADATA_OVERRIDES', '\n};\n'),
  ...['audioBaseName', 'prettyName'].map(extract),
  'this.overrides = SONG_METADATA_OVERRIDES;'
].join('\n'), c);

// The same lookup mapCollectionItems uses for the library.
function shown(folder, name) {
  const p = c.prettyName(name);
  const metadata = c.overrides[`${folder}/${name}`] || p;
  return { name, title: metadata.title, artist: metadata.artist };
}

const recordings = ['songs', 'songs/christian'].flatMap(folder =>
  JSON.parse(fs.readFileSync(path.join(root, folder, 'manifest.json'), 'utf8'))
    .map(row => shown(folder, row.name)));

const ALBUM_TAG = / - IN THE ROOM!$/;
const outsideParentheses = text => text.replace(/\([^)]*\)/g, '');
const artistNames = artist => artist
  .split(/,|&|\bfeat\.|\bft\.|\bfeaturing\b|\(|\)/i)
  .map(part => part.trim().toLowerCase())
  .filter(part => part.length > 1);

test('every recording has a title and an artist', () => {
  assert.ok(recordings.length >= 130);
  assert.deepEqual(recordings.filter(song => !song.title || !song.artist).map(song => song.name), []);
});

test('no title starts with an artist', () => {
  const broken = recordings.filter(song =>
    artistNames(song.artist).some(name => song.title.toLowerCase().startsWith(name)));
  assert.deepEqual(broken.map(song => song.name), []);
});

test('no title carries an upload tag in front of the song name', () => {
  // The only " - " a title may keep is the In The Room album tag.
  const broken = recordings.filter(song => song.title.replace(ALBUM_TAG, '').includes(' - '));
  assert.deepEqual(broken.map(song => `${song.name} → ${song.title}`), []);
});

test('featured singers are credited with the artists, not in the title', () => {
  const broken = recordings.filter(song => /\b(feat\.|ft\.|featuring)\s/i.test(outsideParentheses(song.title)));
  assert.deepEqual(broken.map(song => `${song.name} → ${song.title}`), []);
  const joy = recordings.find(song => /Can't Steal My Joy/.test(song.name));
  assert.equal(joy.title, "Can't Steal My Joy");
  assert.equal(joy.artist, 'Josiah Queen feat. Brandon Lake');
  const rock = recordings.find(song => /Compass \(Rock Version/.test(song.name));
  assert.equal(rock.title, 'Compass (Rock Version feat. Mili Vocals)', 'a credit inside a version note stays');
});

test("rinboku's piano version is titled Encore Dance", () => {
  const rinboku = recordings.find(song => /^rinboku - /.test(song.name));
  assert.equal(rinboku.title, 'Encore Dance (Piano)');
  assert.equal(rinboku.artist, 'rinboku');
});
