/**
 * Turns a Claude Design export into an Apps Script HTML partial.
 *
 * Apps Script serves HTML files only — it cannot serve a .css, an .otf or a
 * .png from the project. Anything the page references by relative path is a
 * dead link. So every token file is concatenated and every binary is inlined
 * as a data: URI, producing one includable partial: appscript/Tokens.html
 *
 * Re-run this whenever the design system is updated. It is the only step
 * between a design export and the live pages.
 *
 *   node dev/build-tokens.mjs <path-to-extracted-project>
 *
 * where <path> is the folder containing _ds/ and assets/.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const projectDir = process.argv[2];
if (!projectDir || !existsSync(projectDir)) {
  console.error('Usage: node dev/build-tokens.mjs <path-to-extracted-project>');
  process.exit(1);
}

const OUT = 'D:/task-tracker/appscript/Tokens.html';

// ---------------------------------------------------------------- locate _ds
const dsRoot = join(projectDir, '_ds');
if (!existsSync(dsRoot)) { console.error('No _ds/ folder under ' + projectDir); process.exit(1); }
const dsName = readdirSync(dsRoot).find(d => statSync(join(dsRoot, d)).isDirectory());
const ds = join(dsRoot, dsName);
console.log('design system:', dsName);

// ------------------------------------------------------------- inline fonts
const MIME = {
  '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp'
};

function dataUri(file) {
  const ext = extname(file).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const fontDir = join(ds, 'assets', 'fonts');
const fonts = existsSync(fontDir) ? readdirSync(fontDir) : [];
const fontUris = {};
for (const f of fonts) {
  fontUris[f] = dataUri(join(fontDir, f));
  console.log('  inlined font:', f, '->', Math.round(fontUris[f].length / 1024) + 'KB base64');
}

// -------------------------------------------------------------- token files
const tokenDir = join(ds, 'tokens');
const ORDER = ['fonts.css', 'colors.css', 'typography.css', 'spacing.css'];
const present = existsSync(tokenDir) ? readdirSync(tokenDir).filter(f => f.endsWith('.css')) : [];
const ordered = [...ORDER.filter(f => present.includes(f)),
                 ...present.filter(f => !ORDER.includes(f))];

let css = '';
const googleFontImports = [];

for (const file of ordered) {
  let text = readFileSync(join(tokenDir, file), 'utf8');

  // Hoist Google Fonts @import out to a <link>: an @import inside an injected
  // <style> is slower and, in a sandboxed Apps Script frame, less reliable.
  text = text.replace(/@import\s+url\((['"]?)(https:\/\/fonts\.googleapis\.com[^)'"]+)\1\);?/g,
    (_m, _q, url) => { googleFontImports.push(url); return `/* google fonts hoisted to <link>: ${url} */`; });

  // Point every @font-face at the inlined copy.
  text = text.replace(/url\((['"]?)([^)'"]*?([A-Za-z0-9_-]+\.(?:otf|ttf|woff2?)))\1\)/g,
    (m, _q, _full, fileName) => {
      if (!fontUris[fileName]) { console.warn('  !! font not found in export:', fileName); return m; }
      return `url("${fontUris[fileName]}")`;
    });

  css += `\n/* ===== ${file} ===== */\n${text.trim()}\n`;
}

// ------------------------------------------------- tokens the board adds itself
// The mockups define a few variables in their own <style> that the design
// system does not carry — the palette is greens only, so amber/red for
// overdue and warning states were the designer's additions. Lift them
// automatically so a design refresh can never silently drop them and leave
// the overdue chips colourless.
const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
const boardFiles = readdirSync(projectDir).filter(f => f.endsWith('.dc.html'));
const extras = new Map();

for (const bf of boardFiles) {
  const board = readFileSync(join(projectDir, bf), 'utf8');
  const used = new Set([...board.matchAll(/var\((--[a-z0-9-]+)/gi)].map(m => m[1]));
  for (const v of used) {
    if (defined.has(v) || extras.has(v)) continue;
    const decl = board.match(new RegExp(v.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+);'));
    if (decl) extras.set(v, decl[1].trim());
    else console.warn('  !! used by the board but defined nowhere:', v);
  }
}

if (extras.size) {
  css += '\n/* ===== state colours — added by the board, not in the design system ===== */\n:root {\n';
  for (const [k, v] of [...extras].sort()) css += `  ${k}: ${v};\n`;
  css += '}\n';
  console.log('  lifted ' + extras.size + ' board-local token(s):', [...extras.keys()].join(', '));
}

// --------------------------------------------------------------- brand marks
const assetDir = join(projectDir, 'assets');
const marks = {};
if (existsSync(assetDir)) {
  for (const f of readdirSync(assetDir)) {
    if (!/\.(png|jpe?g|svg|webp)$/i.test(f)) continue;
    marks[basename(f, extname(f))] = dataUri(join(assetDir, f));
    console.log('  inlined asset:', f);
  }
}

// ------------------------------------------------------------------- emit
const linkTags = [...new Set(googleFontImports)]
  .map(u => `<link rel="stylesheet" href="${u}">`).join('\n');

const marksJs = Object.keys(marks).length
  ? `\n<script>\n// Brand marks, inlined — Apps Script cannot serve project images.\nwindow.BRAND = ${JSON.stringify(marks, null, 0)};\n</script>\n`
  : '';

const out = `<!--
  GENERATED FILE — do not edit by hand.
  Built from the design export by dev/build-tokens.mjs.
  Design system: ${dsName}
  Rebuild:  node dev/build-tokens.mjs <path-to-extracted-project>

  Include it first on every page:  <?!= include('Tokens'); ?>
-->
${linkTags ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${linkTags}` : ''}
<style>
${css.trim()}
</style>${marksJs}`;

writeFileSync(OUT, out);
const kb = Math.round(out.length / 1024);
console.log(`\nwrote ${OUT}  (${kb}KB)`);
if (kb > 900) console.warn('WARNING: partial is large; Apps Script pages get slow past ~1MB.');
