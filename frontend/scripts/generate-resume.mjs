import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('src/assets/resume.pdf');
const pageWidth = 595.28;
const pageHeight = 841.89;

const escapePdf = (value) => value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
const text = (value, x, y, size = 9.2, font = 'F1', color = '0.10 0.11 0.13') =>
  `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`;
const rect = (x, y, width, height, color) => `${color} rg ${x} ${y} ${width} ${height} re f`;
const line = (x1, y1, x2, y2, color = '0.78 0.80 0.82') => `${color} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`;

const section = (label, y) => [
  text(label.toUpperCase(), 44, y, 8.4, 'F2', '0.44 0.50 0.08'),
  line(44, y - 5, 551, y - 5, '0.72 0.75 0.77')
];

const bullets = (items, startY, options = {}) => {
  const { x = 55, width = 94, size = 8.6, leading = 12 } = options;
  const outputLines = [];
  let y = startY;
  for (const item of items) {
    const words = item.split(' ');
    let current = '';
    const rows = [];
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > width && current) {
        rows.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) rows.push(current);
    rows.forEach((row, index) => {
      if (index === 0) outputLines.push(text('-', x - 11, y, size, 'F2', '0.44 0.50 0.08'));
      outputLines.push(text(row, x, y, size));
      y -= leading;
    });
    y -= 3;
  }
  return { content: outputLines, y };
};

const pageOne = [];
pageOne.push(rect(0, 705, pageWidth, 137, '0.05 0.06 0.09'));
pageOne.push(text('SURAJ DEEPAK JHA', 44, 790, 24, 'F2', '1 1 1'));
pageOne.push(text('AI Engineer | Generative AI | LLM Systems | Voice AI', 44, 767, 11.2, 'F1', '0.82 0.87 0.42'));
pageOne.push(text('Mumbai, India (Open to Ahmedabad / Remote)  |  +91 9867751859  |  surajjha462002@gmail.com', 44, 738, 8.2, 'F1', '0.89 0.91 0.92'));
pageOne.push(text('LinkedIn: linkedin.com/in/ai-surajjha  |  GitHub: github.com/Surajj06  |  Portfolio: aisurajjha.in', 44, 721, 8.2, 'F1', '0.89 0.91 0.92'));

pageOne.push(...section('Summary', 678));
const summary = bullets([
  'AI Engineer building Generative AI, LLM, RAG, MCP, and real-time Voice AI systems for insurance operations.',
  'Experienced in multi-provider LLM orchestration, agentic workflows, retrieval systems, FastAPI, and speech pipelines.',
  'Built a configurable voice platform designed for 10,000+ daily calls across concurrent bots, with configured STT, TTS, and LLM provider adapters.'
], 658, { width: 100, size: 9, leading: 12 });
pageOne.push(...summary.content);

pageOne.push(...section('Experience', summary.y - 8));
let y = summary.y - 30;
pageOne.push(text('Probus Insurance Broker Private Limited', 44, y, 11.3, 'F2'));
pageOne.push(text('AI Engineer | Aug. 2025 - Present | Ahmedabad, Gujarat', 44, y - 15, 8.7, 'F1', '0.36 0.40 0.45'));
const experience = bullets([
  'Architected a configurable AI voice platform for insurance operations, designed for 10,000+ daily calls across concurrent bots with a real-time STT - VAD - LLM - TTS pipeline.',
  'Built provider-agnostic LLM orchestration spanning OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, and DeepSeek with health-based failover.',
  'Developed vehicle data mapping and normalization pipelines with rule-based scoring and insurance-domain validation for GCV and PCV quotation workflows.',
  'Designed MCP server architectures and n8n automation workflows that orchestrate LLMs, REST APIs, PostgreSQL, and Redis.',
  'Built FastAPI and Flask microservices; automated data extraction from 74+ insurance partner portals with Selenium and async HTTP.'
], y - 34, { width: 100, size: 8.5, leading: 11.5 });
pageOne.push(...experience.content);

pageOne.push(...section('Selected Projects', experience.y - 4));
y = experience.y - 27;
const projects = [
  ['AI Voice Calling Platform', 'Pipecat, FastAPI, Twilio, VAD, STT/TTS adapters, multi-provider LLM failover, RAG, PostgreSQL, Redis, Angular, .NET, Docker, Prometheus, Grafana.'],
  ['Vehicle Catalogue Matching Engine', 'Python, pandas, RapidFuzz, PostgreSQL, and audit trails for GCV/PCV partner catalogue normalization.'],
  ['API Health Monitor', 'Async FastAPI monitor for 74+ partner APIs with UP/SLOW/DOWN/ERROR classification and Email, Slack, Teams alerts.']
];
for (const [name, detail] of projects) {
  pageOne.push(text(name, 44, y, 9.2, 'F2'));
  const wrapped = bullets([detail], y - 13, { x: 44, width: 104, size: 8.3, leading: 10.5 });
  pageOne.push(...wrapped.content);
  y = wrapped.y - 3;
}

const pageTwo = [];
pageTwo.push(rect(0, 765, pageWidth, 77, '0.05 0.06 0.09'));
pageTwo.push(text('SURAJ DEEPAK JHA', 44, 800, 18, 'F2', '1 1 1'));
pageTwo.push(text('AI ENGINEER - PROJECTS, SKILLS, AND EDUCATION', 44, 780, 8.5, 'F2', '0.82 0.87 0.42'));

pageTwo.push(...section('More Project Work', 735));
let pageTwoY = 714;
const moreProjects = [
  ['Stock Intelligence Engine', 'FastAPI stock-research system combining price technicals, 11 news feeds, FinBERT, sentence-transformers, FAISS, and an OpenAI or local Ollama analysis option.'],
  ['WhatsApp Document Verification Bot', 'FastAPI, WhatsApp Cloud API, OpenCV/Tesseract, PostgreSQL, sentence-transformers, FAISS, and Fernet encryption for privacy-first document processing.'],
  ['Conversational Quote Assistant', 'Flask chat flow that collects insurance details and calls insurer quotation APIs, with transparent demo fallbacks when a provider is unavailable.']
];
for (const [name, detail] of moreProjects) {
  pageTwo.push(text(name, 44, pageTwoY, 9.4, 'F2'));
  const wrapped = bullets([detail], pageTwoY - 13, { x: 44, width: 104, size: 8.4, leading: 10.8 });
  pageTwo.push(...wrapped.content);
  pageTwoY = wrapped.y - 3;
}

pageTwo.push(...section('Technical Skills', pageTwoY - 7));
const skills = [
  ['AI and agentic systems', 'Generative AI, LLM systems, RAG, Agentic AI, MCP, function calling, structured outputs, prompt engineering, NLP, machine learning.'],
  ['LLM providers and local AI', 'OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, DeepSeek, Ollama.'],
  ['Voice AI', 'Pipecat, Twilio Media Streams, Silero/WebRTC VAD, Sarvam AI, Deepgram, ElevenLabs, Cartesia, Azure Speech.'],
  ['Backend and data', 'Python, FastAPI, Flask, REST APIs, WebSockets, Server-Sent Events, AsyncIO, C#, .NET, ASP.NET Core, PostgreSQL, MySQL, Redis, SQLite.'],
  ['Retrieval, data, and delivery', 'sentence-transformers, FAISS, FinBERT, Pandas, RapidFuzz, NumPy, scikit-learn, Docker, Git, Linux, CI/CD, Prometheus, Grafana, AWS S3, Azure.']
];
for (const [label, detail] of skills) {
  pageTwo.push(text(label, 44, pageTwoY - 28, 8.8, 'F2'));
  const wrapped = bullets([detail], pageTwoY - 41, { x: 44, width: 104, size: 8.2, leading: 10.2 });
  pageTwo.push(...wrapped.content);
  pageTwoY = wrapped.y - 2;
}

pageTwo.push(...section('Education and Certifications', pageTwoY - 7));
pageTwo.push(text('University of Mumbai - Master of Computer Applications', 44, pageTwoY - 30, 9.1, 'F2'));
pageTwo.push(text('Sept. 2024 - May 2026 | Mumbai, India', 44, pageTwoY - 44, 8.4, 'F1', '0.36 0.40 0.45'));
pageTwo.push(text('Nagindas Khandwala College - B.Sc. Computer Science', 44, pageTwoY - 61, 9.1, 'F2'));
pageTwo.push(text('Jun. 2021 - May 2024 | Mumbai, India', 44, pageTwoY - 75, 8.4, 'F1', '0.36 0.40 0.45'));
pageTwo.push(text('Certification: Cloud Computing and Distributed Systems - NPTEL (Elite), IIT Kanpur - Score: 76% - Jan-Mar 2026', 44, pageTwoY - 96, 8.1));
pageTwo.push(text('Claude 101 - Anthropic Claude AI Fundamentals - Anthropic', 44, pageTwoY - 110, 8.1));
pageTwo.push(text('References and detailed case studies are available through the portfolio.', 44, 48, 8.1, 'F1', '0.36 0.40 0.45'));

const makePage = (content, objectNumber, contentObjectNumber) => {
  const stream = content.join('\n');
  return {
    page: `${objectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`,
    stream: `${contentObjectNumber} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`
  };
};

const first = makePage(pageOne, 3, 4);
const second = makePage(pageTwo, 7, 8);
const objects = [
  '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R 7 0 R] /Count 2 >>\nendobj\n',
  first.page,
  first.stream,
  '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  second.page,
  second.stream
];

let pdf = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
const offsets = [0];
for (const object of objects) {
  offsets.push(Buffer.byteLength(pdf, 'binary'));
  pdf += object;
}
const xref = Buffer.byteLength(pdf, 'binary');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let index = 1; index < offsets.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(pdf, 'binary'));
console.log(`Wrote ${output}`);
