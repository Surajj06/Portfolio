// Renders every page of src/assets/resume.pdf to src/assets/resume-p<N>.webp.
// Those images are the real-resume preview in the "Resume" section of the site.
//
// Run `npm run resume:preview` whenever you replace resume.pdf, then commit the
// updated images. (It is a manual step on purpose: it needs the optional
// @napi-rs/canvas binary that pdfjs-dist installs, so it is not part of the build.)
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const WIDTH = 1000; // px — sharp enough for a ~350px preview on a 2x screen

const pdf = await getDocument({
  data: new Uint8Array(await readFile(path.join(root, 'src/assets/resume.pdf'))),
  useSystemFonts: true,
  isEvalSupported: false
}).promise;

try {
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: WIDTH / base.width });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    const file = path.join(root, `src/assets/resume-p${n}.webp`);
    await writeFile(file, await canvas.encode('webp', 88));
    console.log(`resume-p${n}.webp  ${canvas.width}x${canvas.height}`);
  }
} finally {
  await pdf.destroy();
}
