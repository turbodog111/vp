// Every recording in the library has drawn cover art; versions of one song share a
// cover; different songs never share one; covers are self-contained SVG images.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const covers = JSON.parse(fs.readFileSync(path.join(root, 'songs/covers/covers.json'), 'utf8')).covers;

function extract(name) {
  const match = new RegExp('^( *)function ' + name + '\\(', 'm').exec(APP);
  assert.ok(match, 'production function exists: ' + name);
  const end = APP.indexOf('\n' + match[1] + '}\n', match.index);
  return APP.slice(match.index, end + match[1].length + 2);
}

const c = vm.createContext({ AUDIO_EXTENSION_RE: /\.(mp3|m4a)$/i });
vm.runInContext(['audioBaseName', 'prettyName', 'coverKeyForTitle'].map(extract).join('\n'), c);
const keyToSlug = new Map(Object.entries(covers).flatMap(([slug, keys]) => keys.map(key => [key, slug])));
const recordings = ['songs', 'songs/christian'].flatMap(folder =>
  JSON.parse(fs.readFileSync(path.join(root, folder, 'manifest.json'), 'utf8')).map(row => row.name));

test('every recording in the library has a cover', () => {
  const missing = recordings.filter(name => !keyToSlug.has(c.coverKeyForTitle(c.prettyName(name).title)));
  assert.deepEqual(missing, []);
});

test('versions of one song share its cover', () => {
  const slugOf = name => keyToSlug.get(c.coverKeyForTitle(c.prettyName(name).title));
  const versions = recordings.filter(name => /encore dance/i.test(name));
  assert.ok(versions.length >= 5);
  assert.equal(new Set(versions.map(slugOf)).size, 1, 'every Encore Dance version uses one cover');
  assert.equal(slugOf("Brandon Lake, Nick Jonas - The Author.m4a"), slugOf("Brandon Lake & Nick Jonas - THE AUTHOR - IN THE ROOM!.m4a"));
  assert.notEqual(slugOf('Pleometric - Im Upping My Pdoom.m4a'), slugOf('PuppyPriestess - Upping My Pbloom (Extended Edition).m4a'));
});

test('cover keys match the version-stripping rules', () => {
  const k = c.coverKeyForTitle;
  assert.equal(k('Compass (Rock Version feat. Mili Vocals)'), 'compass');
  assert.equal(k('Encore Dance: Piano Hyperpop'), 'encore dance');
  assert.equal(k('piano - Encore Dance (Piano)'), 'encore dance');
  assert.equal(k("DADDY'S DNA (ACOUSTIC) - IN THE ROOM!"), "daddy's dna");
  assert.equal(k("Can't Steal My Joy feat. Brandon Lake"), "can't steal my joy");
  assert.equal(k("I'm Upping My P(doom)"), "i'm upping my p(doom)");
});

test('each cover is its own self-contained SVG drawing', () => {
  const hashes = new Map();
  for (const slug of Object.keys(covers)) {
    const svg = fs.readFileSync(path.join(root, 'songs/covers', `${slug}.svg`), 'utf8');
    assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 100 100'>/, slug);
    assert.ok(svg.endsWith('</svg>'), slug);
    assert.doesNotMatch(svg, /<script|<foreignObject|<image|href=['"]https?:/i, `${slug} loads nothing else`);
    assert.ok(svg.length < 40000, `${slug} stays small`);
    const hash = crypto.createHash('sha256').update(svg).digest('hex');
    assert.ok(!hashes.has(hash), `${slug} is not a copy of ${hashes.get(hash)}`);
    hashes.set(hash, slug);
  }
  assert.equal(fs.readdirSync(path.join(root, 'songs/covers')).filter(n => n.endsWith('.svg')).length, Object.keys(covers).length, 'no stray cover files');
});
