// Appearance: every theme defines every colour, its text meets WCAG AA, light themes keep
// Now Playing on a dark stage, and the <head> script, app.js and styles.css agree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function constant(name) {
  const start = APP.indexOf(`const ${name} = [`);
  assert.ok(start >= 0, name);
  const end = APP.indexOf('\n];\n', start);
  return JSON.parse(JSON.stringify(vm.runInNewContext(APP.slice(start + `const ${name} = `.length, end + 2))));
}
const LOOKS = constant('APPEARANCE_LOOKS');
const FONTS = constant('APPEARANCE_FONTS');

// Every rule's selectors and custom properties, in file order.
const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector.split(',').map(s => s.trim()),
  vars: Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])),
  body,
}));

// The tokens a theme ends up with on <html>: the :root defaults, then its [data-look] rules.
function tokens(id) {
  const own = `[data-look="${id}"]`;
  const out = {};
  for (const rule of rules) {
    if (rule.selectors.includes(':root') || rule.selectors.includes(own)) Object.assign(out, rule.vars);
  }
  return out;
}

const hex = value => {
  const m = /^#([0-9a-f]{6})$/i.exec(value || '');
  assert.ok(m, `a 6-digit colour: ${value}`);
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
};
const luminance = rgb => {
  const [r, g, b] = rgb.map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const sameRgb = (value, triple, what) => assert.deepEqual(triple.split(/\s+/).map(Number), hex(value), what);

function checkPalette(name, t, p = '') {
  const v = key => t[`${p}${key}`];
  const surfaces = ['bg', 'panel', 'panel-2'].map(v);
  for (const s of surfaces) {
    assert.ok(contrast(v('fg'), s) >= 7, `${name}: text on ${s}`);
    assert.ok(contrast(v('fg-dim'), s) >= 4.5, `${name}: dim text on ${s} is ${contrast(v('fg-dim'), s).toFixed(2)}`);
    assert.ok(contrast(v('fg-faint'), s) >= 4.5, `${name}: faint text on ${s} is ${contrast(v('fg-faint'), s).toFixed(2)}`);
  }
  sameRgb(v('bg'), v('bg-rgb'), `${name}: bg-rgb`);
  sameRgb(v('panel'), v('panel-rgb'), `${name}: panel-rgb`);
}

test('every theme in the picker has colours in styles.css', () => {
  assert.equal(LOOKS[0].id, 'iris', 'Ink & Iris stays the default');
  assert.equal(new Set(LOOKS.map(look => look.id)).size, LOOKS.length);
  assert.ok(LOOKS.filter(look => look.scheme === 'dark').length >= 5);
  assert.ok(LOOKS.filter(look => look.scheme === 'light').length >= 2);
  const required = ['bg', 'bg-rgb', 'panel', 'panel-rgb', 'panel-2', 'border', 'fg', 'fg-dim', 'fg-faint',
    'look-accent', 'look-accent-2', 'look-accent-rgb', 'look-accent-fg', 'focus', 'glow-rgb', 'brand-a', 'brand-b'];
  for (const look of LOOKS) {
    const t = tokens(look.id);
    for (const key of required) assert.ok(t[key], `${look.id} defines --${key}`);
    if (look.id !== 'iris') assert.ok(rules.some(rule => rule.selectors.includes(`[data-look="${look.id}"]`) && rule.vars.bg), `${look.id} has its own palette`);
  }
});

test('every theme\'s text meets WCAG AA on its backgrounds', () => {
  for (const look of LOOKS) {
    const t = tokens(look.id);
    checkPalette(look.id, t);
    for (const s of [t.bg, t.panel, t['panel-2']]) {
      assert.ok(contrast(t['look-accent'], s) >= 4.5, `${look.id}: accent text on ${s} is ${contrast(t['look-accent'], s).toFixed(2)}`);
    }
    assert.ok(contrast(t['look-accent-fg'], t['look-accent']) >= 4.5, `${look.id}: text on an accent button`);
    assert.ok(contrast(t['look-accent-fg'], t['look-accent-2']) >= 4.5, `${look.id}: text on a hovered accent button`);
    assert.ok(contrast(t.focus, t.bg) >= 3, `${look.id}: focus ring`);
    sameRgb(t['look-accent'], t['look-accent-rgb'], `${look.id}: look-accent-rgb`);
  }
});

test('light themes are light, and keep Now Playing on a readable dark stage', () => {
  for (const look of LOOKS.filter(item => item.scheme === 'light')) {
    const t = tokens(look.id);
    assert.ok(luminance(hex(t.bg)) > 0.7, `${look.id} is a light page`);
    assert.ok(rules.some(rule => rule.selectors.includes(`[data-look="${look.id}"]`) && /color-scheme:\s*light/.test(rule.body)), `${look.id} says it is light`);
    const stage = { ...t };
    checkPalette(`${look.id} stage`, stage, 'stage-');
    assert.ok(luminance(hex(t['stage-bg'])) < 0.03, `${look.id}: the stage is dark`);
    for (const s of [t['stage-bg'], t['stage-panel'], t['stage-panel-2']]) {
      assert.ok(contrast(t['stage-accent'], s) >= 4.5, `${look.id}: stage accent on ${s}`);
    }
    assert.ok(contrast(t['stage-accent-fg'], t['stage-accent']) >= 4.5, `${look.id}: text on the stage accent`);
    sameRgb(t['stage-accent'], t['stage-accent-rgb'], `${look.id}: stage-accent-rgb`);
  }
  assert.match(CSS, /\.main:has\(> #view-now\.active\)\s*\{\s*background: var\(--stage-bg\);/);
  for (const look of LOOKS.filter(item => item.scheme === 'dark')) {
    assert.ok(luminance(hex(tokens(look.id).bg)) < 0.03, `${look.id} is dark`);
  }
});

test('a song\'s own accent stays in Now Playing; the app around it keeps the theme\'s', () => {
  const chrome = rules.find(rule => rule.selectors.some(s => s.startsWith(':is(.topbar')) && rule.vars.accent === 'var(--look-accent)');
  assert.ok(chrome, 'the app chrome resets --accent to the theme\'s');
  const covered = chrome.selectors.join(',');
  for (const part of ['.topbar', '.tabs', '#view-library', '#view-playlists', '.player', '.eq-backdrop']) {
    assert.ok(covered.includes(part), part);
  }
  assert.doesNotMatch(covered, /#view-now/, 'Now Playing keeps the song\'s accent');
});

test('the <head> script, app.js and styles.css name the same themes and fonts', () => {
  const head = HTML.slice(0, HTML.indexOf('</script>'));
  const listed = /\/\^\(([a-z|]+)\)\$\//.exec(head)[1].split('|');
  assert.deepEqual(listed, LOOKS.filter(look => look.id !== 'iris').map(look => look.id));
  const light = Object.keys(vm.runInNewContext(`(${/var light = (\{[^}]*\})/.exec(head)[1]})`));
  assert.deepEqual(light, LOOKS.filter(look => look.scheme === 'light').map(look => look.id));
  const fonts = JSON.parse(JSON.stringify(vm.runInNewContext(`(${/var fonts = (\{[^}]*\})/.exec(head)[1]})`)));
  assert.deepEqual(fonts, Object.fromEntries(FONTS.filter(font => font.family).map(font => [font.id, font.family])));
  for (const font of FONTS.filter(item => item.id !== 'atkinson')) {
    assert.match(CSS, new RegExp(`html\\[data-font="${font.id}"\\] \\{ --font-ui:`), font.id);
  }
});

test('the Appearance controls are in Settings, with a shortcut in the quick menu', () => {
  for (const id of ['settings-appearance', 'theme-options', 'appearance-font', 'appearance-glow']) {
    assert.match(HTML, new RegExp(`id="${id}"`), id);
  }
  assert.match(HTML, /name="appearance-density" value="compact"/);
  const menu = HTML.slice(HTML.indexOf('id="settings-menu"'), HTML.indexOf('</header>'));
  assert.match(menu, /id="appearance-open"/);
  assert.match(APP, /setAppearance\('look', look\.id\)/);
});
