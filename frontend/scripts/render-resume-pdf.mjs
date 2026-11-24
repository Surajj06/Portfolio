// Renders resume/resume.html to src/assets/resume.pdf with a locally installed
// Chrome or Edge (headless "print to PDF"), then checks the result is two pages.
//
//   npm run resume          # PDF + the page previews used by the site
//   npm run resume:pdf      # PDF only
//
// Set CHROME_PATH to use a specific browser. Calibri is used when installed
// (Windows/macOS with Office); other machines fall back to Carlito/Arial, which can
// change line breaks slightly, so render on the machine you normally use.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'resume/resume.html');
const output = path.join(root, 'src/assets/resume.pdf');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chrome or Edge found. Install one, or set CHROME_PATH to its executable.');
  process.exit(1);
}

const run = spawnSync(
  browser,
  ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${output}`, pathToFileURL(source).href],
  { stdio: 'inherit', timeout: 60_000 }
);
if (run.status !== 0 || !existsSync(output)) {
  console.error('The browser did not produce a PDF.');
  process.exit(1);
}

const pdf = await getDocument({ data: new Uint8Array(await readFile(output)), useSystemFonts: true, isEvalSupported: false }).promise;
const pages = pdf.numPages;
await pdf.destroy();
console.log(`Wrote ${path.relative(root, output)} (${pages} page${pages === 1 ? '' : 's'})`);
if (pages !== 2) {
  console.error(`Expected exactly 2 pages, got ${pages}. Trim text in resume/resume.html or adjust its margins.`);
  process.exit(1);
}
