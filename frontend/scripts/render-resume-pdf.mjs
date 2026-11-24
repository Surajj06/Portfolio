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

// How full is each page? (last inked row within the printable area). Optional: skipped if
// the canvas module is unavailable. Handy for keeping page 2 comfortably more than half full.
const fills = [];
try {
  const { createCanvas } = await import('@napi-rs/canvas');
  const marginIn = 0.42; // keep in step with @page in resume.html
  for (let n = 1; n <= pages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let last = 0;
    for (let y = height - 1; y >= 0 && !last; y--) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) { last = y; break; }
      }
    }
    const usable = height - 2 * marginIn * 72 * 1.2;
    fills.push(Math.max(0, Math.min(100, Math.round(((last - marginIn * 72 * 1.2) / usable) * 100))));
  }
} catch {
  /* page-fill report is a nicety */
}
await pdf.destroy();
console.log(`Wrote ${path.relative(root, output)} (${pages} page${pages === 1 ? '' : 's'}${fills.length ? `, fill ${fills.map((f, i) => `p${i + 1} ${f}%`).join(', ')}` : ''})`);
if (pages !== 2) {
  console.error(`Expected exactly 2 pages, got ${pages}. Trim text in resume/resume.html or adjust its margins.`);
  process.exit(1);
}
