// After `ng build`: tell the browser about the two entry scripts up front.
//
// Angular emits <link rel="modulepreload"> for the shared chunks but the entry
// scripts (polyfills + main) are only discovered when the HTML parser reaches the
// end of <body> — on a slow phone that is a second or more after everything else
// has downloaded. Preloading them in <head> means they are already in the cache
// the moment the parser gets there. Runs on every prerendered page; idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/suraj-jha-portfolio/browser');
if (!fs.existsSync(root)) {
  console.error(`postbuild: ${root} not found — run "ng build" first`);
  process.exit(1);
}

const pages = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.html') pages.push(full);
  }
})(root);

let patched = 0;
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const entries = [...html.matchAll(/<script\s+src="((?:polyfills|main)-[A-Za-z0-9]+\.js)"\s+type="module"/g)].map((m) => m[1]);
  const missing = entries.filter((src) => !html.includes(`rel="modulepreload" href="${src}"`));
  if (!missing.length) continue;
  const links = missing.map((src) => `<link rel="modulepreload" href="${src}">`).join('');
  if (!html.includes('</head>')) continue;
  fs.writeFileSync(file, html.replace('</head>', `${links}</head>`));
  patched++;
}
console.log(`postbuild: preloaded entry scripts in ${patched}/${pages.length} pages`);
