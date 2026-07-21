// Assembles the Vite build into one self-contained file for Artifact publishing.
// The Artifact wrapper supplies <!doctype>/<html>/<head>/<body>, so we emit only
// page content: a <title>, an inline <style>, the markup, and an inline module.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('./dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');

const files = readdirSync(assets);
const jsName = files.find((f) => f.endsWith('.js'));
const cssName = files.find((f) => f.endsWith('.css'));

const js = readFileSync(join(assets, jsName), 'utf8');
const css = readFileSync(join(assets, cssName), 'utf8');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

// Body markup only, minus the build's own script/link tags.
const body = html
  .slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'))
  .trim();

// A literal </script> inside the bundle would close our inline tag early.
const safeJs = js.replace(/<\/script/gi, '<\\/script');

// The night lake is a deliberate single-theme world. Keep the ground dark even
// when the viewer's theme toggle stamps data-theme="light" on the root.
const themeLock = `
:root, :root[data-theme="light"], :root[data-theme="dark"] { color-scheme: dark; }
html, body,
:root[data-theme="light"] body,
:root[data-theme="dark"] body { background: #060a1c; }
@media (prefers-reduced-motion: reduce) {
  #begin-btn, .intro-card h1, .intro-card .subtitle, .intro-card .hint,
  .panel:not(.hidden), .dock-item.just-picked { animation: none !important; }
  .ui { transition: opacity 0.2s linear !important; }
}
`;

const out = `<title>Floating Lantern</title>
<style>
${css}
${themeLock}</style>

${body}

<script type="module">
${safeJs}
</script>
`;

const target = new URL('./artifact/floating-lantern.html', import.meta.url).pathname;
writeFileSync(target, out);
console.log(`wrote ${target} (${(out.length / 1024).toFixed(0)} KB)`);
