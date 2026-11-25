// Saved library filters: a filter chooses which songs the Library shows, survives a
// reload, and treats songs added to VP later by its own rule. (Arrays made inside the vm
// sandbox are copied with [...] before deepEqual, which compares prototypes.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extract(name) {
  const match = new RegExp('^( *)function ' + name + '\\(', 'm').exec(APP);
  assert.ok(match, 'production function exists: ' + name);
  const end = APP.indexOf('\n' + match[1] + '}\n', match.index);
  return APP.slice(match.index, end + match[1].length + 2);
}

const PURE = ['makeLibraryFilter', 'parseLibraryFilters', 'serializeLibraryFilters', 'libraryFilterShows',
  'setLibraryFilterSongs', 'setLibraryFilterNewSongs', 'newSongsHiddenByFilter', 'nextLibraryFilterName'];
function context(extra = {}) {
  const c = vm.createContext({ ...extra });
  vm.runInContext(PURE.map(extract).join('\n'), c);
  return c;
}

const A = 'songs/A.m4a', B = 'songs/B.m4a', C = 'songs/christian/C.m4a', NEW = 'songs/New.m4a';

test('no saved filter shows every song', () => {
  const c = context();
  assert.equal(c.libraryFilterShows(null, A), true);
});

test('a new filter shows the whole library until songs are unticked', () => {
  const c = context();
  const f = c.makeLibraryFilter('My songs', [A, B, C], 'f1');
  assert.deepEqual([A, B, C].map(p => c.libraryFilterShows(f, p)), [true, true, true]);
  c.setLibraryFilterSongs(f, [B], false);
  assert.deepEqual([A, B, C].map(p => c.libraryFilterShows(f, p)), [true, false, true]);
  c.setLibraryFilterSongs(f, [B], true);
  assert.equal(c.libraryFilterShows(f, B), true);
});

test('songs added later follow the filter\'s rule, and changing the rule keeps today\'s songs as they are', () => {
  const c = context();
  const f = c.makeLibraryFilter('Teto', [A, B], 'f1');
  c.setLibraryFilterSongs(f, [A, B], false);
  c.setLibraryFilterSongs(f, [A], true);
  assert.equal(c.libraryFilterShows(f, NEW), true, 'new songs show by default');
  assert.deepEqual([...c.newSongsHiddenByFilter(f, [A, B, NEW])], [], 'nothing to report while new songs show');

  // C joined the library while the rule was "show"; switching the rule keeps it shown.
  c.setLibraryFilterNewSongs(f, 'hide', [A, B, C]);
  assert.equal(f.newSongs, 'hide');
  assert.equal(c.libraryFilterShows(f, C), true, 'a song already in the library keeps showing');
  assert.equal(c.libraryFilterShows(f, NEW), false, 'a song added afterwards stays hidden');
  assert.deepEqual([...c.newSongsHiddenByFilter(f, [A, B, C, NEW])], [NEW], 'and the Library says so');
  c.setLibraryFilterSongs(f, [NEW], false);
  assert.deepEqual([...c.newSongsHiddenByFilter(f, [A, B, C, NEW])], [], '"Keep hidden" settles it');
});

test('filters survive a save and reload; damaged saved data is ignored', () => {
  const c = context();
  const f = c.makeLibraryFilter('  Chill  ', [A, B], 'f1');
  c.setLibraryFilterSongs(f, [B], false);
  c.setLibraryFilterNewSongs(f, 'hide', [A, B]);
  const [back] = c.parseLibraryFilters(c.serializeLibraryFilters([f]));
  assert.equal(back.id, 'f1');
  assert.equal(back.newSongs, 'hide');
  assert.deepEqual([A, B, NEW].map(p => c.libraryFilterShows(back, p)), [true, false, false]);

  assert.equal(c.parseLibraryFilters(null).length, 0);
  assert.equal(c.parseLibraryFilters('{not json').length, 0);
  assert.equal(c.parseLibraryFilters('{"filters": "nope"}').length, 0);
  const odd = c.parseLibraryFilters(JSON.stringify({ filters: [
    { id: 'x', name: 'x'.repeat(80), hidden: [A, 7], seen: 'bad', newSongs: 'maybe' },
    { id: 'x', name: 'duplicate id' },
    { name: 'no id' },
    { id: 'y', name: '   ' },
  ] }));
  assert.deepEqual([...odd.map(item => item.id)], ['x', 'y']);
  assert.equal(odd[0].name.length, 40);
  assert.equal(odd[0].newSongs, 'show');
  assert.deepEqual([...odd[0].hidden], [A]);
  assert.equal(odd[0].seen.size, 0);
  assert.equal(odd[1].name, 'Filter');
});

test('new filters get a name that isn\'t taken', () => {
  const c = context();
  assert.equal(c.nextLibraryFilterName([]), 'My songs');
  assert.equal(c.nextLibraryFilterName([{ name: 'my songs' }, { name: 'My songs 2' }]), 'My songs 3');
});

test('the Library lists the saved filter\'s songs, and every song while they are being chosen', () => {
  const library = [
    { path: A, collection: 'secular', displayName: 'Ann — Alpha' },
    { path: B, collection: 'secular', displayName: 'Ben — Beta' },
    { path: C, collection: 'christian', displayName: 'Cat — Gamma' },
  ];
  const c = context({ library, activeCollection: 'all', libraryFilterEditing: false });
  const f = c.makeLibraryFilter('Mine', [A, B, C], 'f1');
  c.setLibraryFilterSongs(f, [B], false);
  vm.runInContext(extract('filteredLibraryEntries'), c);
  c.activeLibraryFilter = () => f;
  const names = (q = '', opts) => c.filteredLibraryEntries(q, opts).map(entry => entry.song.path);
  assert.deepEqual(names(), [A, C]);
  assert.deepEqual(names('gamma'), [C], 'search works inside the filter');
  c.libraryFilterEditing = true;
  assert.deepEqual(names(), [A, B, C], 'choosing songs lists every song');
  c.libraryFilterEditing = false;
  c.activeCollection = 'christian';
  assert.deepEqual(names(), [C], 'the collection tab still applies');
});

test('choosing songs: tick boxes replace the add-to-playlist zone, and the choice is saved in this browser', () => {
  assert.match(extract('openAddToMenuFromEvent'), /if \(libraryFilterEditing\) return false;/);
  const render = extract('renderLibrary');
  assert.match(render, /library-filter-toggle/);
  assert.match(render, /aria-label', `Show \$\{songLabel\(song\)\}`/);
  assert.match(extract('saveLibraryFilters'), /writeSetting\(LIBRARY_FILTERS_KEY/);
  assert.match(APP, /let libraryFilters = parseLibraryFilters\(readSetting\(LIBRARY_FILTERS_KEY\)\);/);
  for (const id of ['library-filter-select', 'library-filter-edit', 'library-filter-editor', 'library-filter-name',
    'library-filter-show-all', 'library-filter-hide-all', 'library-filter-new', 'library-filter-delete',
    'library-filter-done', 'library-filter-notice']) {
    assert.match(HTML, new RegExp(`id="${id}"`), id);
  }
  // Deleting takes a second press on the same button rather than a pop-up.
  assert.match(extract('deleteActiveLibraryFilter'), /confirming/);
  assert.doesNotMatch(extract('deleteActiveLibraryFilter'), /confirm\(/);
});
