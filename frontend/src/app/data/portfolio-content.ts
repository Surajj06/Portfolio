/**
 * Plain-data portfolio content — the single source of truth for everything the
 * site says about Suraj. It deliberately imports nothing from Angular so the
 * same file feeds both the UI (PortfolioDataService) and the chat assistant's
 * knowledge base (frontend/api/chat.ts). Edit copy here; both stay in step.
 *
 * Nothing here is fabricated: project figures were checked against each
 * project's code, tests and docs. Where a number isn't published, the case
 * study says so. Project copy never names a company.
 */
import type { ProjectBase, ProjectMeta } from '../models/project.model';
import type { ExperienceEntry } from '../models/experience.model';

/** One group of tools/skills. (`icon` is an icon name the UI maps to a glyph.) */
export interface TechCategoryData {
  name: string;
  subtitle: string;
  icon: string;
  items: string[];
}

/**
 * Presentation metadata for each project: filter group, art colour, and the
 * headline facts shown on cards. Every figure below comes from that project's
 * own source, docs or tests (checked against the code, not just the README) —
 * nothing is invented. If you change a case study, keep these in step with it.
 */
export const PROJECT_META: Record<string, ProjectMeta> = {
  'ai-voice-calling-platform': {
    categories: ['AI / ML'],
    accent: 'lime',
    highlights: [
      { value: '1.1s', label: 'measured: caller stops → first agent audio' },
      { value: '13', label: 'LLM providers supported, with mid-call failover' },
      { value: '4,000+', label: 'automated Python tests' },
      { value: '30+', label: 'provider integrations: STT, TTS, LLM and telephony' }
    ]
  },
  'mmv-data-extractor': {
    categories: ['Data', 'Automation'],
    accent: 'mint',
    highlights: [
      { value: '4,534', label: 'variants captured in one real run' },
      { value: '1,807', label: 'models across 710 makes and 13 vehicle types' },
      { value: 'Resumable', label: 'stop any time — nothing is lost or re-fetched' }
    ]
  },
  'mmv-master-inserter': {
    categories: ['Data', 'Automation'],
    accent: 'sky',
    highlights: [
      { value: '24', label: 'partner-specific runners, goods and passenger' },
      { value: '2,200+', label: 'make aliases in the normaliser' },
      { value: 'Dry-run', label: 'preview every insert before it touches the master' }
    ]
  },
  'vehicle-catalogue-matching-engine': {
    categories: ['Data'],
    accent: 'violet',
    highlights: [
      { value: '15+', label: 'insurance partners on one codebase' },
      { value: 'Days → mins', label: 'per-partner reconciliation' },
      { value: '~10,000×', label: 'fewer comparisons via grouping' }
    ]
  },
  'vehicle-mapping-workspace': {
    categories: ['Backend & Full-stack', 'Data'],
    accent: 'pink',
    highlights: [
      { value: '19', label: 'partner configurations with column aliases' },
      { value: '1', label: 'serializable transaction per apply — all or nothing' },
      { value: '15 min', label: 'validation freshness window before apply' }
    ]
  },
  'conversational-quote-assistant': {
    categories: ['Backend & Full-stack'],
    accent: 'sky',
    highlights: [
      { value: '11', label: 'questions in the guided conversation' },
      { value: '0', label: 'backend changes needed' },
      { value: 'Chat', label: 'replaces a multi-field form' }
    ]
  },
  'agent-gamification-platform': {
    categories: ['Backend & Full-stack'],
    accent: 'coral',
    highlights: [
      { value: 'Live', label: 'leaderboard over SignalR' },
      { value: '5', label: 'tiers, from Bronze to Diamond' },
      { value: '3', label: 'roles: agent, admin, master' }
    ]
  },
  'api-health-monitor': {
    categories: ['Backend & Full-stack'],
    accent: 'mint',
    highlights: [
      { value: '83', label: 'partner APIs checked concurrently' },
      { value: '4', label: 'statuses: UP, SLOW, DOWN, ERROR' },
      { value: '3', label: 'alert channels: email, Slack, Teams' }
    ]
  },
  'stock-intelligence-engine': {
    categories: ['AI / ML', 'Data'],
    accent: 'amber',
    highlights: [
      { value: '11', label: 'news feeds merged and deduped' },
      { value: '$0', label: 'market-data cost — free sources only' }
    ]
  },
  'daily-report-automation': {
    categories: ['AI / ML', 'Automation'],
    accent: 'lime',
    highlights: [
      { value: '30 min', label: 'trigger cadence, no server to run' },
      { value: '21:00', label: 'team report goes out even with no reply' },
      { value: '5', label: 'missed days retried per run, oldest first' }
    ]
  },
  'whatsapp-document-verification-bot': {
    categories: ['AI / ML'],
    accent: 'coral',
    highlights: [
      { value: '0', label: 'document content sent to external LLMs' },
      { value: 'Encrypted', label: 'files and sensitive fields at rest' }
    ]
  }
};

export const PROFILE = {
  name: 'Suraj Deepak Jha',
  role: 'AI Engineer',
  tagline: 'AI Engineer | Voice AI | LLM Systems',
  email: 'surajjha462002@gmail.com',
  phone: '+91 9867751859',
  github: 'https://github.com/Surajj06',
  linkedin: 'https://www.linkedin.com/in/ai-surajjha/',
  instagram: 'https://www.instagram.com/_surajj06/' as string | null,
  photoUrl: '/assets/profile.webp' as string | null,
  resumePath: '/assets/resume.pdf',
  // Name the browser saves the resume under when someone downloads it.
  resumeFileName: 'Suraj_resume.pdf',
  status: 'Building with AI',
  // Shown on the About "local time" tile — edit if this isn't right.
  location: 'India',
  timezone: 'Asia/Kolkata',
  timezoneLabel: 'IST',
  // Rotating hero identity line — each one maps directly to a techStack
  // category or the experience entry below, not an invented title.
  heroIdentities: ['AI Engineer', 'Voice AI Builder', 'LLM Systems Engineer', 'Automation Builder']
};

/** Big-number strip under the hero — each figure is quoted from a case study. */
export const STATS = [
  { value: '4,000+', label: 'Automated tests behind the voice platform' },
  { value: '83', label: 'Partner APIs monitored in real time' },
  { value: '15+', label: 'Insurance partners reconciled by one matching engine' },
  { value: '11', label: 'Systems built, each with a full case study and a live demo' }
];

export const ABOUT = {
  summary:
    'I\'m an AI Engineer specializing in Generative AI, LLM systems, and real-time Voice AI for insurance operations. My work spans LLM orchestration, RAG, MCP integrations, agentic workflows, and the real-time speech and backend engineering needed to run them reliably at scale.',
  focusAreas: [
    'Generative AI',
    'Large Language Models',
    'Real-Time Voice AI',
    'RAG',
    'Agentic AI',
    'MCP (Model Context Protocol)',
    'Ollama',
    'Prompt Engineering',
    'Function Calling',
    'Structured Outputs',
    'Multi-Provider AI',
    'Python',
    'FastAPI',
    'Microservices',
    'Data Processing',
    'Production AI Systems'
  ]
};

export const APPROACH = [
  {
    index: '01',
    title: 'Understand the Problem',
    description:
      'Before touching a model or a framework, I define what success actually looks like — the constraints, the users, and the failure modes that matter most.'
  },
  {
    index: '02',
    title: 'Design the System',
    description:
      'AI features live inside larger systems. I design the data flow, the orchestration layer, and the interfaces between the model and everything around it.'
  },
  {
    index: '03',
    title: 'Build & Integrate',
    description:
      'I implement with production in mind from the start — typed APIs, sensible error handling, and integration points that are easy to reason about.'
  },
  {
    index: '04',
    title: 'Evaluate & Improve',
    description:
      'AI systems drift and degrade. I build evaluation into the loop so quality is measured, not assumed, and improvements are grounded in evidence.'
  }
];

export const EXPERIENCE: ExperienceEntry[] = [
  {
    role: 'AI Engineer',
    company: 'Probus Insurance Broker Private Limited',
    duration: 'Aug 2025 — Present',
    description:
      'Building AI systems for insurance operations — a configurable voice platform, multi-provider LLM orchestration, vehicle-data automation pipelines, and MCP-based agentic workflows.',
    responsibilities: [
      'Architected a configurable AI voice platform for insurance operations, designed for 10,000+ daily calls across concurrent bots with a real-time STT → VAD → LLM → TTS pipeline.',
      'Built a provider-agnostic LLM orchestration layer spanning multiple providers (OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, DeepSeek, and others) with automatic health-based failover and live mid-call provider switching.',
      'Developed vehicle data mapping and normalization pipelines with rule-based scoring and insurance-domain validation logic for GCV and PCV quotation workflows.',
      'Designed MCP server architectures and n8n automation pipelines orchestrating LLMs, REST APIs, and PostgreSQL/Redis databases into scalable production workflows.',
      'Built RESTful microservices with FastAPI and Flask; automated data extraction from 74+ insurance partner portals using Selenium and async HTTP with rate-limit-safe execution.',
      'Operated production AI systems serving thousands of daily user interactions with high availability, using provider health tracking and automatic failover, Redis-based concurrency control, and Prometheus + Grafana observability.'
    ],
    technologies: ['Python', 'FastAPI', 'Pipecat', 'Twilio', 'OpenAI', 'Anthropic Claude', 'Google Gemini', 'PostgreSQL', 'Redis', 'Docker', 'C#', '.NET', 'Angular'],
    contributions: [
      'Provider-agnostic multi-LLM orchestration layer with automatic failover, used across the voice platform and internal automation workflows.',
      'Vehicle data mapping pipeline that directly powers the company\'s GCV/PCV quotation portal.'
    ]
  }
];

// githubUrl/liveUrl are null across the board — these are employer-owned
// private codebases, not open-source repos with public links. Each project
// instead carries a `demo`: a small in-browser version of its real logic that a
// visitor can use on the case-study page. Project copy never names a company.
export const BASE_PROJECTS: ProjectBase[] = [
  {
    id: 'ai-voice-calling-platform',
    index: '01',
    title: 'AI Voice Calling Platform',
    summary: 'A configurable real-time voice AI platform that places and answers phone calls, with multi-provider failover and a live monitoring dashboard.',
    description:
      'A configurable AI voice platform for insurance operations — a real-time VAD → STT → LLM → TTS pipeline over telephony, ten speech-to-text and nine text-to-speech providers, mid-call LLM failover, per-assistant knowledge bases, and a multi-tenant dashboard for staff to monitor and control calls.',
    concepts: ['Voice AI', 'Real-Time Systems', 'Telephony', 'LLM Orchestration', 'Multi-Provider Failover', 'RAG'],
    techStack: ['Python', 'Pipecat', 'FastAPI', 'Twilio', 'SIP (Asterisk ARI)', 'Sarvam AI', 'OpenAI', 'Anthropic Claude', 'Google Gemini', 'Groq', 'Mistral', 'DeepSeek', 'Silero VAD', 'Smart Turn', 'PostgreSQL', 'Redis', 'C#', '.NET', 'Angular', 'Docker', 'Prometheus', 'Grafana'],
    workflowSteps: ['Call connects', 'VAD + turn detection + noise suppression', 'Speech-to-text', 'Prompt-driven LLM + knowledge tool', 'Text-to-speech', 'Live dashboard update'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Run a call turn yourself',
      intro:
        'Reply to the agent the way a caller would — type anything, or tap a quick reply. Watch the turn travel through the pipeline stage by stage, see which tool the agent calls, and break the primary LLM to watch the backup take over.'
    },
    caseStudy: {
      problem:
        'Staff were making large volumes of routine outbound calls — reminders, onboarding walk-throughs, campaign updates — that follow a script but need to feel like a conversation. The goal: a configurable voice platform where each campaign is an "assistant" (prompt, voice, knowledge documents, tools) that can place and answer calls, with a dashboard for staff to monitor and control them.',
      whyItWasDifficult:
        'A phone call tolerates almost no dead air: after the caller stops talking, speech recognition, a language model and speech synthesis all have to finish before the caller hears anything, over a lossy 8 kHz audio path and in noisy real-world environments. On top of that: correctly pronouncing Indian names and terms, staying inside calling-hours and do-not-call rules, handling callbacks the caller asks for in their own words, and depending on enough independent providers (telephony, STT, TTS, several LLMs) that any one of them having a bad day should not take calls down.',
      architecture:
        'Three services. A Python voice engine (FastAPI + Pipecat) owns each live call: telephony audio comes in over Twilio, Plivo, Exotel or carrier SIP, passes voice-activity detection, Smart Turn end-of-turn detection and noise suppression, then streaming speech-to-text, the LLM, and text-to-speech back to the caller. A .NET API is the control plane, and an Angular dashboard (about fifty screens: live monitoring, campaigns, callbacks, evals, a voice library, logs, metrics) sits on top of it. The dashboard only ever talks to the engine and API — never to telephony or AI providers directly. PostgreSQL holds configuration, Redis caches knowledge and coordinates per-assistant concurrency slots, and recordings and source documents live in object storage.',
      technicalApproach:
        'The conversation is prompt-driven: each assistant has a structured system prompt (identity check, availability, one step at a time, callback and closing rules) and the LLM handles every turn — a small keyword layer only recognises plain yes/no style replies. Facts come from one "knowledge" function over the assistant\'s own documents, and the prompts forbid guessing anything person-specific: the agent hands those to an account manager instead. The LLM layer is provider-agnostic across thirteen providers, with mid-call failover and a hedged backup request if the primary is slow to answer. Speech providers are swappable the same way, with a fallback chain for text-to-speech.',
      implementation:
        'The agent can call fifteen types of tool, including end-call, transfer, callback scheduling, contact lookup and sending an email after hang-up. Calling hours and do-not-call lists are enforced before a call is placed, a pronunciation dictionary of roughly 670 words keeps names and terms intelligible, and end-of-call classifiers record sentiment, outcome and structured results. Per-call cost is tracked against provider pricing, and provider health is learned from real call outcomes. Prompts are pinned by tests, so a template can never drift from its master file.',
      challenges:
        'Latency and turn-taking. First agent audio arrives about 1.1 seconds after the caller stops talking, measured on live calls, and the bot deliberately waits about 0.7 seconds of quiet before it answers so it does not talk over someone mid-sentence. Prompts also kept failing in small ways that only real calls reveal — a bare "Hello?" read as a yes, a callback promised before the tool had succeeded.',
      solution:
        'Rather than guess, the team listened to real recordings and fixed what they heard: pickup words are treated as "not yet a yes" and the identity question is re-asked once in fewer words; the agent only confirms a callback after the callback tool returns success; and every fix lands with a test and a changelog entry. Latency is measured stage by stage rather than guessed at, and a hedged backup LLM request trims the tail when the primary provider is slow to answer.',
      evaluation:
        'The Python engine has roughly 4,000 test functions across more than 400 test files; the .NET API has over 1,200 test cases and the Angular dashboard over 800. Prompt-pinning tests assert that every assistant template equals its master prompt and that key figures in prompts match the data. The changelog records each fix found in live test calls.',
      results:
        'A working platform in active use and iteration: three services, a campaign-driven dashboard, thirteen supported LLM providers with failover, and a measured first agent audio of about 1.1 seconds after the caller stops. Concurrent calls per assistant is a configurable setting (default 5, up to 50); live-call capacity at scale has not been load-tested here, so no throughput number is published.',
      futureImprovements:
        'Getting the full spoken answer out faster as well (the first word from the model is the largest slice of that), live-model evaluation of the newer assistant prompts, and measured capacity numbers from a real load test of the voice path.'
    }
  },
  {
    id: 'mmv-data-extractor',
    index: '02',
    title: 'MMV Data Extractor',
    summary: 'A resumable web scraper that walks a commercial-vehicle master — type → make → model → variant — and exports a clean, id-keyed Excel.',
    description:
      'A web data extractor that reads a vehicle-insurance quote flow\'s own master-data calls and walks the full tree — 13 vehicle types, their makes, models and variants with GVW, fuel and ids — into SQLite and Excel. It paces itself, stops cleanly when the site pushes back, and resumes exactly where it stopped.',
    concepts: ['Web Scraping', 'Browser Automation', 'Data Extraction', 'Idempotent Pipelines', 'Data Quality'],
    techStack: ['Python', 'Playwright', 'Chrome DevTools Protocol', 'SQLite', 'pandas', 'openpyxl', 'PowerShell'],
    workflowSteps: ['Attach to a browser on the quote page', 'Fetch makes for a type', 'Fetch models for a make', 'Fetch variants for a model', 'Save each result to SQLite', 'Autosave Excel + anomaly report'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Watch it crawl — then stop it',
      intro:
        'A miniature vehicle master runs through the same extraction loop. Start it, hit a simulated rate limit, watch it stop cleanly with progress saved, then resume and see finished scopes skipped.'
    },
    caseStudy: {
      problem:
        'A complete, current vehicle master — every type, make, model and variant, with GVW, fuel, capacities and the source\'s numeric ids — was needed to reconcile against internal catalogues, but it only existed behind a multi-step quote form. Copying it by hand would take days and would silently drift out of date.',
      whyItWasDifficult:
        'The tree is big (thousands of variants), the same names repeat everywhere — one make under several vehicle types, one model name under several makes, one variant label with different weights or fuels — and a long crawl will inevitably be interrupted by a closed window, a flaky network or the site asking you to slow down. A scraper that merges by name, records a failed fetch as "no variants", or restarts from zero on every interruption quietly produces a wrong master.',
      architecture:
        'The tool attaches over the Chrome DevTools Protocol to a browser the user starts and leaves on a quote page, and calls the site\'s own three master-data endpoints (makes, models, variants) from that page, reusing the session the site already trusts. A loop walks type → make → model → variant, finishing one model with all its variants saved before moving to the next. Every result is committed to SQLite as it arrives, and a progress table keyed by scope (makes of a type, models of a make, variants of a model) records running, done or failed. The Excel export is rewritten from that store.',
      technicalApproach:
        'Everything is keyed by the source\'s numeric ids, never by name, so equal names are never merged. NULL means "not yet fetched" and 0 means "the site really lists none" — only a true 0 produces a blank-variant row. An empty answer is asked a second time after a short pause before it is believed, and a response of the wrong shape marks that scope failed so it is retried next run instead of being recorded as empty. Variant labels are parsed into variant name and fuel by splitting on the last " - " only when the tail is a known fuel, and the weight in the label is cross-checked against the weight the API reports.',
      implementation:
        'Calls are paced with a random delay and a longer pause every 150 calls, with a speed multiplier. An HTTP 403, 429 or 503, or a page that looks like a captcha, stops the run cleanly with progress saved — nothing is bypassed, no proxies, no spoofing, and the tool never clicks anything, it only reads. Eight failed calls in a row also stop the run. Ctrl+C, closing the console, a logoff or a crash all trigger an emergency Excel save, and the workbook is also autosaved every 45 seconds when data has changed, written atomically so a half-written file can never replace a good one. Re-fetching a list replaces its children in one transaction, so there are no stale or duplicate rows.',
      challenges:
        'Proving that "resume" is really correct — that an interrupted run followed by a finished run yields exactly the same master as one uninterrupted run, with no duplicates and no silently missing branch.',
      solution:
        'An offline test suite runs the real loop against a fake site and checks the awkward cases directly: a second run costs zero calls, a malformed answer marks a scope failed and the next run repairs it, a rate-limit response stops the run with progress kept, and re-fetching replaces children rather than appending. A built-in verify command checks the saved data for orphan rows and count mismatches, which must all be zero.',
      evaluation:
        'Eleven offline test scenarios (label parsing, parsing a real captured answer, id uniqueness, zero-cost resume, Excel output, retry and empty-answer recheck, malformed answers, rate-limit stop, the consecutive-failure breaker, child replacement). A verify command reports structural errors and informational counts (missing weight, missing fuel, name collisions) after every run, and an Anomalies sheet records anything odd the parser saw.',
      results:
        'One real run captured 13 vehicle types, 710 makes, 1,807 models and 4,534 variants, with fuel and weight parsed for every variant and only five weight-label mismatches flagged for review. The Excel carries a clean master sheet, a full sheet with every id and capacity, a summary, the anomalies and the extraction log.',
      futureImprovements:
        'A scheduled re-extraction that diffs the new master against the previous one and reports additions and removals, and exposing the progress table through a small status page.'
    }
  },
  {
    id: 'mmv-master-inserter',
    index: '03',
    title: 'MMV Master Inserter',
    summary: 'Reads partner Excel files and inserts only the genuinely missing makes, models and variants into the master — checking before every insert.',
    description:
      'A data-loading tool that takes a partner\'s vehicle file, normalises it, and inserts the makes, models and variants that are truly missing from the three master tables — never creating a duplicate, with a dry-run mode, per-row logging and a runner for each partner\'s file layout.',
    concepts: ['Data Normalisation', 'Master Data Management', 'ETL', 'Deduplication', 'SQL'],
    techStack: ['Python', 'pandas', 'pyodbc', 'psycopg2', 'SQL Server', 'PostgreSQL', 'openpyxl'],
    workflowSteps: ['Read the partner file', 'Normalise the make through the alias map', 'Find or insert the make', 'Find or insert the model', 'Match variant on name + fuel + weight', 'Log every decision and commit'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Add a vehicle — see exactly what happens',
      intro:
        'Type any make, model and variant, or paste a batch. The tool replays the real decision logic — alias map, exact match, core-token match, fuel and weight disambiguation — against a live in-page master, step by step.'
    },
    caseStudy: {
      problem:
        'Every partner sends vehicle files with their own spellings, and the master tables have to gain the vehicles that are genuinely new — without gaining a second "TATA MOTORS LTD" next to "TATA", or collapsing two real variants into one. Doing it by hand was slow and the duplicates it produced were expensive to clean up.',
      whyItWasDifficult:
        'Two failure modes pull in opposite directions. Match too loosely and a different manufacturer (a heavy-equipment maker that merely shares a word with a truck maker) is merged into the wrong make; match too strictly and every spelling variant becomes a duplicate. At the variant level, the same name with a different fuel or weight is a different vehicle, but a blank fuel in the partner\'s file must never count as a mismatch. And a large load must survive one bad row.',
      architecture:
        'A shared pipeline reads a partner file through a common reader, and each partner has its own small runner that maps that partner\'s columns — 24 runners in all, nine for passenger vehicles and fifteen for goods vehicles. Three handlers (make, model, variant) each follow find-before-insert against the master tables; model and variant lookups are scoped by product line, and a variant is also scoped by its make and model. The same pipeline runs against SQL Server in production and PostgreSQL for testing.',
      technicalApproach:
        'Makes pass through a normaliser — uppercase, collapsed whitespace, then an explicit alias map of about 2,200 spellings merged from the goods and passenger configurations — and are then looked up exactly, then by a same-length LIKE, then by core tokens: generic words such as MOTORS, LTD and INDIA are stripped and the remaining token set is compared to every make in the database, auto-matching only when exactly one make has that same set. If several match it is logged as ambiguous and treated as new rather than guessed. Models are matched by exact uppercase name within their make. Variants are matched by name plus fuel plus weight, which fixed a documented batch of false "already in the database" matches.',
      implementation:
        'Each row is committed on its own, so a row-level error is rolled back and the run continues. In-memory caches mean a vehicle repeated inside one file is found, not inserted twice. A dry-run flag records every action as skipped without touching the master, and each row logs the make, model and variant ids with the action taken — found, inserted, skipped or error — followed by a coloured summary of counts and elapsed time.',
      challenges:
        'Alias maps rot: a variation that maps to the wrong standard name silently merges two manufacturers, and the maps are generated from two large configurations that can disagree.',
      solution:
        'The alias map is rebuilt by a script that merges both configurations, applies explicit removals for known traps (a construction-equipment maker that must not map to a truck maker, for instance), resolves variations claimed by more than one standard name, and lets the built-in aliases — the ones verified against the live master — win last.',
      evaluation:
        'Validated through dry-runs and per-row logs on real partner files rather than an automated test suite; the built-in aliases were verified against the master, and the variant matching rules were checked against a recorded set of false matches. An automated regression suite is the clearest next step.',
      results:
        'A single pipeline loads missing makes, models and variants from 15 distinct partners across 24 file layouts, without duplicating what is already in the master, and every decision is traceable in the run log.',
      futureImprovements:
        'Automated regression tests over the alias map and the variant rules, unifying the SQL Server and PostgreSQL variant handlers (the PostgreSQL one still matches by name only), and committing in batches with savepoints.'
    }
  },
  {
    id: 'vehicle-catalogue-matching-engine',
    index: '04',
    title: 'Vehicle Catalogue Matching Engine',
    summary: 'A fuzzy-matching pipeline that standardizes vehicle master data across 15+ insurance partners, powering a quotation portal.',
    description:
      'An end-to-end vehicle master data standardization pipeline processing thousands of records across 15+ insurance partners, directly powering a goods- and passenger-vehicle quotation portal — replacing a manual Excel-matching process that used to take days per partner.',
    concepts: ['Data Engineering', 'Fuzzy Matching', 'Data Reconciliation', 'Automation', 'ETL'],
    techStack: ['Python', 'pandas', 'rapidfuzz', 'TF-IDF retrieval', 'PostgreSQL', 'openpyxl', 'NumPy'],
    workflowSteps: ['Load catalogue + partner files', 'Normalize make/model/fuel/GVW', 'Group by normalized make', 'Multi-field rule gates', 'Confidence scoring', 'Feed quotation portal + audit trail'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Match a messy partner row',
      intro:
        'Pick a row from a partner\'s catalogue — or type your own — and watch it normalise, get grouped by make, face the rule gates, and get scored. Then run the whole file and see how many comparisons grouping avoided.'
    },
    caseStudy: {
      problem:
        'The internal vehicle catalogue needed to be reconciled against catalogues from 15+ insurance partners, each using different naming conventions, so every vehicle could be linked to the right product line for premium generation — previously done by hand in Excel.',
      whyItWasDifficult:
        'Every partner encodes the same vehicle differently: different make spellings, fuel type as text vs. letter codes vs. numeric codes, gross vehicle weight rounded differently, model names sometimes sitting in the wrong column entirely. Naively comparing every internal row against every partner row is quadratic — for a single mid-sized partner file, a full cross-join runs well into the hundreds of millions of comparisons, which is not something you can run repeatedly by hand or brute-force in code. On top of that, this pipeline is not just a reporting tool — it directly feeds the quotation portal, so a bad match means a wrong premium quote.',
      architecture:
        'Rows are first grouped by a normalized make name, which cuts the comparison space by roughly four orders of magnitude before any matching starts. Within each group, candidate pairs pass through multi-field rule gates — vehicle type, fuel, gross vehicle weight, wheels, seating or engine capacity for passenger vehicles — where failing any single gate is an automatic reject regardless of how similar the text looks. Pairs that clear every gate get fuzzy-scored on make, model, and variant text and assigned a cross-field confidence score. Modular, per-partner matching engines write standardized output into PostgreSQL with a full audit trail.',
      technicalApproach:
        'Matching uses rapidfuzz string similarity — a plain ratio for make names, a token-set ratio for model names so word order and extra tokens do not break a match, and a token-sort ratio for variant text. A second-generation matcher adds TF-IDF candidate retrieval before scoring and combines five signals into one 0–100 confidence. Partner-specific quirks (numeric type codes, oddly-encoded weight fields, model names in the wrong column) are handled by small, partner-specific preprocessing functions rather than one tangled set of general-purpose rules, which keeps each partner\'s edge cases isolated and easy to reason about independently.',
      implementation:
        'Each partner runs through its own modular matching engine sharing the same core pipeline, writing to a standardized PostgreSQL schema with an audit trail for every match decision. The same architecture was extended across both goods-vehicle and passenger-vehicle catalogues by swapping in new rule gates and a partner configuration, not by rewriting the matching logic.',
      challenges:
        'One partner recorded a fleet vehicle\'s actual rated weight, where the internal catalogue used a single standardized weight for that whole vehicle class — which quietly suppressed matches across an entire segment.',
      solution:
        'Rather than special-casing that one partner, the fix was generalized into a rule applied to any partner showing the same standardization pattern, which recovered matches across several other partners with the identical issue and pushed the match rate for that problem segment from roughly 50% into the high 50s.',
      evaluation:
        'Matching quality is validated by inspecting match counts and the unmatched/review sheets after each run against known partner files, backed by the PostgreSQL audit trail for traceability on every decision, plus regression tests covering the matching rules for the goods and passenger engines.',
      results:
        'Processes thousands of vehicle records across 15+ insurance partners on one shared codebase, and directly powers premium generation on the goods- and passenger-vehicle quotation lines. A reconciliation run that used to take a person days per partner now completes in minutes. Exact accuracy figures are not published here — ask Suraj if he wants specific numbers included.',
      futureImprovements:
        'Parallelizing matching across make-groups, moving partner onboarding from code changes to configuration files, and broadening the automated regression suite are the clearest next steps.'
    }
  },
  {
    id: 'vehicle-mapping-workspace',
    index: '05',
    title: 'Vehicle Mapping Workspace',
    summary: 'An Angular + ASP.NET Core tool that imports a partner mapping workbook, validates it against SQL, and applies it in one safe transaction.',
    description:
      'A local workstation application for the last step of vehicle mapping: import a partner\'s Excel workbook (only the rows you highlighted), preview and validate it against the live database, then apply the changes in a single serializable transaction — with an audit trail that never stores worksheet data.',
    concepts: ['Full-Stack', 'Data Validation', 'Transactions', 'Audit Logging', 'Safe Automation'],
    techStack: ['Angular', 'TypeScript', 'ASP.NET Core', 'C#', '.NET', 'SQL Server', 'Playwright', 'xUnit', 'Python'],
    workflowSteps: ['Import workbook, read yellow-highlighted IDs', 'Preview rows + issues', 'Validate against SQL', 'Confirm by typing the partner name', 'Apply in one serializable transaction', 'Metadata-only audit log'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Import, validate, apply — or roll back',
      intro:
        'Highlight rows in a mock workbook, edit the mapping values, and run the same checks: only highlighted rows import, bad values block their row, the database is compared case-insensitively, and apply is all-or-nothing.'
    },
    caseStudy: {
      problem:
        'After a matching run, a reviewer fixes mappings in Excel — which make and model ids each partner row should point to — and a command-line script wrote them to the database. It worked, but it was a terminal with a typed YES: no preview, no per-row reasons, no history, and a mistake mid-run left some rows updated and others not.',
      whyItWasDifficult:
        'The write is the dangerous part: four id columns on live rows that feed quotations. The tool has to be strict enough to refuse a bad row for a reason the reviewer can read, careful enough that two people (or a retry) cannot overwrite each other, and honest about state — including the awkward case where the connection drops during the commit itself.',
      architecture:
        'An Angular single-page app talks to an ASP.NET Core API bound to loopback on one workstation. The API parses the workbook in memory, holds previews only in process memory, validates against SQL Server, and applies. A fixed catalogue of 19 partner configurations supplies each partner\'s column aliases and rules. Only run metadata and audit events are written to disk.',
      technicalApproach:
        'Only rows whose ID cell has a solid yellow fill are imported, which lets a reviewer select exactly what to change by highlighting it. Blank target values mean "leave unchanged", negative ids are allowed, and fractional values, formulas and duplicate ids block their rows. Validation compares the partner\'s make, model and fuel text with the database, ignoring case and repeated whitespace, and — stricter than the old script — a mismatch or a missing validation value blocks the row instead of skipping the check.',
      implementation:
        'Only four columns can ever change, SQL is parameterised, and table and column names come only from the fixed catalogue. Writes are off unless explicitly enabled, the reviewer types the exact partner name to confirm, and the preview must have been validated within the last 15 minutes and can be applied once. All eligible rows go in one serializable transaction: each is re-read with a lock and compared to the validation snapshot, updated, checked to have affected exactly one row, and re-read to verify the new values. Any failure rolls the whole transaction back; an interruption during the commit marks the run "Review required" so nobody retries blindly.',
      challenges:
        'Making failure safe and legible: a half-applied mapping is worse than none, and a reviewer needs to know whether anything changed.',
      solution:
        'Single-transaction, verify-after-write apply with locked re-reads, plus an explicit status for the one case that cannot be resolved automatically. The audit log keeps counts, status and events — never worksheet rows or SQL snapshots — and is deleted after 24 hours.',
      evaluation:
        'About 29 .NET test cases cover workbook parsing, duplicate and fractional ids, row limits, validation mismatches, target rules, audit-log privacy and API behaviour; three Playwright specs drive the real browser-to-API flow with writes disabled; and a Python test pins the legacy yellow-fill rule. Live commit behaviour is meant to be exercised on a dedicated staging database.',
      results:
        'A reviewable, repeatable replacement for the terminal script: previews with per-row reasons, searchable run history with CSV export, and an apply step that either changes everything that passed validation or nothing at all.',
      futureImprovements:
        'Organisational sign-in and roles, durable shared storage, and a deployment-specific security profile — the current build is deliberately a single-user local tool.'
    }
  },
  {
    id: 'conversational-quote-assistant',
    index: '06',
    title: 'Conversational Quote Assistant',
    summary: 'A chat-based front end that replaces a multi-field insurance quote form with a guided conversation.',
    description:
      'A chat-based front end that replaces a multi-field two-wheeler insurance quote form with a guided, eleven-question conversation, calling the exact same backend the original web form uses.',
    concepts: ['Conversational UX', 'State Machines', 'API Integration', 'Session Management'],
    techStack: ['Python', 'Flask', 'Flask-Session', 'Gunicorn', 'Docker'],
    workflowSteps: ['Collect RTO + vehicle details', 'Collect registration + policy type', 'Collect prior policy + claim info', 'Check eligible partners', 'Fetch a quote per partner', 'Present results'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Get a quote by chatting',
      intro:
        'Answer the assistant step by step. Watch the real request payload build field by field, try a vague vehicle name to see the "did you mean" search, and see one partner fail without blocking the others.'
    },
    caseStudy: {
      problem:
        'Turn an existing multi-field two-wheeler insurance quote form into a step-by-step chat flow, without changing the backend that actually generates quotes.',
      whyItWasDifficult:
        'The conversation has real branching logic — whether the customer has a prior policy changes which follow-up questions appear, and how long ago that policy lapsed changes which quote type gets requested. Free-text vehicle input has to resolve to the exact structured record the backend expects, and one partner\'s API failing should not block quotes from the others.',
      architecture:
        'A Flask app tracks conversation progress as a named step in a server-side session, with a step-to-handler dispatch table driving what gets asked next across eleven questions (RTO, make, model, variant, registration number, policy type, prior policy, expiry, claim, purchase date, confirmation). Once enough details are collected, it checks which partners are eligible to quote this vehicle, then calls each eligible partner in turn for a price.',
      technicalApproach:
        'This is a scripted state machine, not an LLM — deterministic step handlers with format-based input validation and a fixed set of response options at each step. Vehicle lookups match against a local reference dataset, falling back to fuzzy search when there is no exact match and re-prompting the user whenever a search turns up more than one plausible result.',
      implementation:
        'Runs behind Gunicorn in a Docker container. Each partner\'s quote call is individually isolated so one partner erroring does not stop the others — failures are collected and surfaced as a count of partners that had errors rather than failing the whole request. A backend connection failure trips a demo mode with sample data, so the chat UI stays testable even when the backend is unreachable.',
      challenges:
        'Reproducing the exact nested payload shape the production web form sends, field for field, so the backend accepts a chat-originated request exactly like a normal form submission.',
      solution:
        'The payload-building logic was isolated into its own module that mirrors the web form\'s request shape directly, so the chat flow and the web form stay compatible with the same unmodified backend.',
      evaluation:
        'Not documented — no automated tests or evaluation scripts exist yet for this project.',
      results:
        'A working chat flow over the unmodified quote backend, with an offline demo mode. Completion-rate and quote-turnaround numbers were not recorded.',
      futureImprovements:
        'There is a clear, already-scoped extension path: adding a private-car product by adding its vehicle data and swapping the payload shape, and reusing the same chat pattern for other vehicle categories.'
    }
  },
  {
    id: 'agent-gamification-platform',
    index: '07',
    title: 'Agent Gamification Platform',
    summary: 'A gamification and leaderboard platform for sales agents, with real-time scoring, tiers and team standings.',
    description:
      'A gamification platform for sales agents — regional teams compete over a season with a live leaderboard, five tiers, achievements, and redeemable offers, pushed to every screen in real time.',
    concepts: ['Real-Time Systems', 'Gamification', 'Role-Based Access Control'],
    techStack: ['C#', '.NET 9', 'ASP.NET Core', 'Entity Framework Core', 'SignalR', 'Angular', 'PostgreSQL'],
    workflowSteps: ['Sale logged', 'Points = base × tier multiplier', 'Tier / achievement check', 'Standings recomputed', 'Live push to every dashboard'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Log a sale, watch the board move',
      intro:
        'Log a policy and see the points maths, a tier-up when you cross a threshold, and the leaderboard re-sort live. Switch roles to see what each one can see, and watch the SignalR-style event stream.'
    },
    caseStudy: {
      problem:
        'A gamified platform to drive sales-agent engagement — agents are grouped into regional teams that compete over a season, with a live leaderboard, tiers, achievements, and redeemable offers.',
      whyItWasDifficult:
        'Every sale needs to update a live leaderboard in real time and roll up into team standings without the leaderboard read path becoming a bottleneck as agents and sales grow. Access also needed three distinct roles — agent, admin, and master — with a two-level manager hierarchy layered on top.',
      architecture:
        'A .NET Web API backend (controllers, services, DTOs, an EF Core data layer over a 17-table design) sits behind a SignalR hub that pushes typed real-time events — a policy sold, a tier upgrade, an updated leaderboard, who is online, live match scores — to an Angular single-page app. The leaderboard filters by period, region, branch and policy type, is cached briefly, and exports to CSV; teams play matches with standings (two points for a win, one for a tie).',
      technicalApproach:
        'Points are the policy type\'s base points multiplied by the agent\'s current tier multiplier, and tiers (Bronze, Silver, Gold, Platinum, Diamond) are decided by policy counts. Leaderboard reads stay fast by maintaining running totals per agent and per team that update the moment a sale is recorded, rather than aggregating from raw sales data on every page load. Role-based policies gate what each of the three user types can see and do.',
      implementation:
        'JWT-based auth with short-lived access tokens and longer-lived refresh tokens, plus password hashing and Swagger-documented endpoints throughout the API.',
      challenges:
        'SignalR client connections cannot always attach custom authorization headers, which conflicts with the header-based JWT scheme used everywhere else in the API.',
      solution:
        'The real-time hub accepts the JWT as a query-string parameter on its connection path specifically, while every other endpoint keeps standard header-based auth — a narrow, contained exception rather than weakening auth everywhere.',
      evaluation:
        'Not documented — no automated tests exist yet for this project.',
      results:
        'A complete platform — roles, tiers, teams, matches, offers, achievements, notifications and a live leaderboard — documented and runnable locally. Engagement numbers were not recorded.',
      futureImprovements:
        'The project currently runs against an in-memory database for local development, with a documented one-line switch to PostgreSQL as the clear next step, followed by an automated test suite.'
    }
  },
  {
    id: 'api-health-monitor',
    index: '08',
    title: 'API Health Monitor',
    summary: 'An async platform concurrently monitoring 83 insurance partner APIs, with status classification and multi-channel alerting.',
    description:
      'A real-time API health platform concurrently tracking 83 insurance partner APIs, classifying their status (UP/DOWN/SLOW/ERROR), alerting across email, Slack, and Teams only when the state actually changes, and serving a live dashboard.',
    concepts: ['Observability', 'Async Programming', 'Reliability Engineering'],
    techStack: ['Python', 'asyncio', 'aiohttp', 'FastAPI', 'Server-Sent Events', 'PostgreSQL', 'Docker', 'pytest'],
    workflowSteps: ['Load the API list from config', 'Concurrent async health checks', 'Classify UP / SLOW / DOWN / ERROR', 'Keep the last 5 results per API', 'Alert on state change only', 'Stream to the live dashboard'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Break an API and watch the alerts',
      intro:
        'A board of partner endpoints runs concurrent checks. Force a status code or a slow response, inject an outage, and watch classification, the last-five window, and why a repeated DOWN does not page anyone twice.'
    },
    caseStudy: {
      problem:
        'Continuously monitor 83 insurance partner APIs (plus custom endpoints) and surface their live status on a dashboard, instead of finding out about a partner outage from a support ticket.',
      whyItWasDifficult:
        'Checking dozens of endpoints on a schedule without overwhelming them or taking too long to notice a real outage required genuine concurrency, plus a classification scheme that distinguishes a truly down partner service from one that is just responding slowly — and alerting needed to fire on real state changes without drowning the team in noise.',
      architecture:
        'An async scheduler drives a concurrent health checker (Python asyncio + aiohttp), bounded by connection limits so it does not hammer any single partner, against an API list loaded from configuration. Each result is classified as UP, SLOW, DOWN, or ERROR from the status code and response time, a short window of the last five results is kept per API, and a multi-channel alerting layer (console, email, Slack and Teams webhooks) reports state changes. A FastAPI dashboard streams updates to the browser over Server-Sent Events, and PostgreSQL stores history.',
      technicalApproach:
        'The API list is config-driven — adding a new partner endpoint to monitor is a configuration change, not a code change. Per-API isolation and configurable timeouts keep one struggling partner from cascading into false alerts for everyone else, and state-change suppression means alerts fire on a real transition rather than on every failed check.',
      implementation:
        'Runs in Docker with its own PostgreSQL instance for history and an automatic cleanup that deletes results older than the retention window, so history does not grow unbounded. The check interval and the slow-response threshold are settings, not constants.',
      challenges:
        'One failing partner API check should not take down the monitor itself, delay checks on every other partner, or trigger an alert storm.',
      solution:
        'Every check runs isolated inside its own error handling within the concurrent batch, and alerts only fire on an actual status-change transition rather than on every individual failed check.',
      evaluation:
        'Twenty-one pytest tests cover the core checking and classification logic, and the monitor has been used operationally against real partner endpoints; a broader regression suite is a documented next step.',
      results:
        'Concurrently tracks 83 partner APIs plus custom endpoints with a live dashboard and multi-channel alerting. Exact incident-detection or uptime figures are not published here — ask Suraj if he wants specific numbers included.',
      futureImprovements:
        'Rounding out the alerting integrations further and growing the automated regression suite.'
    }
  },
  {
    id: 'stock-intelligence-engine',
    index: '09',
    title: 'Stock Intelligence Engine',
    summary: 'A personal project: a local app that turns any Indian company name into a full stock report, built on free market-data sources.',
    description:
      'A personal project — a local web app that turns any Indian company name into a structured stock report: price action, technical indicators, aggregated news with sentiment, and an AI-generated summary, using free data sources.',
    concepts: ['Personal Project', 'Data Pipelines', 'NLP', 'LLM Integration', 'Financial Data'],
    techStack: ['Python', 'FastAPI', 'PostgreSQL', 'SQLAlchemy', 'yfinance', 'feedparser', 'sentence-transformers', 'FAISS', 'FinBERT', 'APScheduler', 'OpenAI / Ollama'],
    workflowSteps: ['Resolve company to ticker', 'Pull price + news in parallel', 'Store in Postgres', 'Dedupe + score sentiment', 'Generate AI summary', 'Serve dashboard'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Indicators and news, computed live',
      intro:
        'Synthetic price history runs through the same indicator maths — Wilder RSI-14 and the 50/200-day averages — with a draggable crosshair. Then merge near-duplicate headlines from several feeds with the same normalise-and-hash dedupe.'
    },
    caseStudy: {
      problem:
        'Get a full picture of an Indian public company — price action, technical indicators, aggregated news, and a plain-language summary — from one search box, without paying for a data subscription.',
      whyItWasDifficult:
        'No single free source covers everything: price history, technicals, and news each come from a different place, and news specifically means merging 11 separate RSS feeds that often republish overlapping stories under different headlines — and free feeds go down. Keeping the market-data side genuinely free meant treating the LLM step as optional rather than required.',
      architecture:
        'A company name resolves to a ticker, which fans out into ingestion: price data and computed technicals on one side, RSS aggregation across 11 financial news sources (six Indian, five global) on the other. Both land in PostgreSQL, after which an AI-analysis step reads the stored price and news data and generates structured summaries and key points, served through a FastAPI backend and a single-page dashboard.',
      technicalApproach:
        'Technicals are computed directly rather than pulled from a paid API — RSI-14 uses proper Wilder smoothing rather than a naive moving average, and the 50/200-day moving averages use standard rolling means. News deduplication hashes normalized headlines to drop exact repeats across feeds, FinBERT scores sentiment, and a separate embedding-based similarity layer goes further, matching genuinely similar historical events rather than just identical headlines. The LLM step defaults to a hosted OpenAI model with a local Ollama option, so the tool can run without an ongoing model-API cost when needed.',
      implementation:
        'A FastAPI backend with SQLAlchemy models, a scheduler that runs ingestion jobs automatically, and prompts constrained to only cite numbers that are actually present in the stored data rather than letting the model speculate.',
      challenges:
        'Free data sources are less reliable than paid ones — feeds go down, rate-limit, or return incomplete data. The project\'s own logs show two of the eleven feeds failing on some runs.',
      solution:
        'The core dashboard is built to degrade gracefully — if one optional data source is unreachable, the rest of the report still renders instead of failing the whole request.',
      evaluation:
        'Not documented — no formal evaluation suite exists; this is a personal side project, not production software. Real runs are recorded in its log.',
      results:
        'A working end-to-end pipeline from a company name to a report, with real runs in its log. No adoption or usage numbers were recorded.',
      futureImprovements:
        'Putting the configured-but-idle background task queue to use for heavier scheduled workloads, building out the similarity index, and adding an evaluation suite.'
    }
  },
  {
    id: 'daily-report-automation',
    index: '10',
    title: 'Daily Report Automation',
    summary: 'A serverless Google Apps Script that turns the day\'s GitHub commits and one email reply into a polished team report, written by Claude.',
    description:
      'A scheduled automation that emails a question at the end of the day listing that day\'s commits, parses the reply, has Claude write clean report items, and sends the team report by a fixed deadline — whether or not anyone replied.',
    concepts: ['Workflow Automation', 'LLM Integration', 'Serverless', 'Reliability', 'Email Parsing'],
    techStack: ['Google Apps Script', 'JavaScript', 'GitHub API', 'Anthropic Claude', 'Gmail', 'Google Sheets'],
    workflowSteps: ['Trigger every 30 minutes', 'Collect the day\'s commits', 'Email the question at 17:30', 'Parse the reply lines', 'Claude writes the items', 'Send the report + log to the sheet'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Parse a reply, build the report',
      intro:
        'Edit the sample reply and commit times: the real parser extracts the items, estimates time from commit gaps (capped at an hour), and a day-timeline shows which automation stage fires — including the 21:00 fallback.'
    },
    caseStudy: {
      problem:
        'Writing a daily work report is a chore that gets skipped or done badly from memory at the end of the day, yet the information already exists — in the commit history and in the person\'s head.',
      whyItWasDifficult:
        'The automation has to be reliable without a server: it must send the question at the right time, tolerate a reply that arrives late, malformed, or never, still deliver the team report by the deadline, catch up on days that were missed, and not spam anyone when an API key runs out of credit.',
      architecture:
        'A time-driven Google Apps Script wakes every 30 minutes and decides what, if anything, is due. At 17:30 India time it emails the day\'s commits as a question; the reply is read from the mailbox and parsed; Claude turns the items into polished report lines; the finished report is emailed to the team and appended as a block to a Google Sheet. There is no server to host or monitor.',
      technicalApproach:
        'Replies are plain lines in the form "Area: what I did - 40 min | environment", parsed by a small pure-function parser, so the person never needs a form. When a line gives no time, it is estimated from the gaps between commits, capped at 60 minutes so a lunch break or an overnight gap is not counted as work. A pure function decides which days are due, which is what makes catch-up safe.',
      implementation:
        'The report is sent by 21:00 even when there is no reply, built from the commits alone. Missed days are retried oldest first, five per run, so a long outage clears without flooding. An API or credit error alerts once rather than on every 30-minute tick. The parsing, time-estimation and due-date helpers are plain JavaScript functions kept separate from the Apps Script services so they can be tested outside Google.',
      challenges:
        'Time estimates from commits are honest but approximate — the README itself documents a case where the estimate was about two hours against about 1 hour 36 minutes actually spent.',
      solution:
        'The estimate is a fallback, not a claim: a time the person typed always wins, the 60-minute cap bounds the error, and the limits are documented rather than hidden.',
      evaluation:
        'A node-based test file runs the pure helpers (about 22 assertions) under a sandbox that mimics Apps Script, covering the parser, the time estimate and the due-date logic.',
      results:
        'A zero-infrastructure automation that produces a daily report on a fixed deadline, with catch-up for missed days and one-time alerts on failure.',
      futureImprovements:
        'Letting the reply carry corrections to earlier days, and reading additional activity sources alongside commits.'
    }
  },
  {
    id: 'whatsapp-document-verification-bot',
    index: '11',
    title: 'WhatsApp Document Verification Bot',
    summary: 'A privacy-first WhatsApp bot that extracts and validates fields from photographed ID documents, with encrypted storage.',
    description:
      'A privacy-first WhatsApp bot that extracts and validates fields from photographed ID documents, stores them encrypted, and answers follow-up questions through a local vector search layer that never sends document content to an external LLM.',
    concepts: ['OCR', 'Document Processing', 'Privacy Engineering', 'Vector Search', 'Encryption'],
    techStack: ['Python', 'FastAPI', 'PostgreSQL', 'Tesseract OCR', 'OpenCV', 'sentence-transformers', 'FAISS', 'cryptography (Fernet)', 'Docker'],
    workflowSteps: ['Receive document via WhatsApp', 'Preprocess image', 'OCR + field extraction', 'Validate + mask PII', 'Encrypt + store', 'Answer questions via local vector search'],
    screenshotUrl: null,
    githubUrl: null,
    liveUrl: null,
    demo: {
      heading: 'Send a (fake) document',
      intro:
        'Send a sample card through the pipeline: preprocessing, OCR with per-field confidence, validation, masking and encryption — and see why a blurry card is routed to manual review instead of auto-accepted.'
    },
    caseStudy: {
      problem:
        'Customers send ID documents as photos over WhatsApp for verification. The bot extracts the relevant fields, validates them, and can answer follow-up questions from the extracted data — without the document or any extracted personal information ever leaving the system through an external API.',
      whyItWasDifficult:
        'Photos taken by customers are inconsistent — skewed, poorly lit, low resolution — which makes OCR unreliable without real preprocessing. Because the documents are government ID, encryption and PII masking had to be first-class design decisions from the start, not added later. Answering questions from the extracted data without calling an external LLM also meant building retrieval entirely locally.',
      architecture:
        'A WhatsApp Cloud API webhook receives incoming documents, downloads the media, and hands it to an image-preprocessing step (grayscale, denoise, deskew, threshold) before OCR. Extracted text runs through field extraction and validation, then the original file is encrypted and the plaintext copy is deleted. A separate local embedding index lets the bot answer questions against stored knowledge without any external LLM call.',
      technicalApproach:
        'Every stored file and sensitive field is encrypted at rest with Fernet, with masking functions that only ever echo back a redacted form of sensitive data in bot replies. Because the question-answering embeddings are generated and searched locally with FAISS, no document content needs to leave the server to answer a follow-up question.',
      implementation:
        'A FastAPI service backed by PostgreSQL, containerized with Docker Compose, with a separate lightweight admin interface for reviewing flagged extractions.',
      challenges:
        'Balancing OCR reliability against processing time on modest hardware — heavier preprocessing improves accuracy but costs latency.',
      solution:
        'Preprocessing is tuned to the minimum needed for consistent extraction rather than maximizing accuracy at any cost, and a configurable confidence threshold routes low-confidence extractions to manual review instead of auto-accepting them.',
      evaluation:
        'This is the least finished project here: the test files exist but are still empty placeholders, one checksum validation is a documented stub, and the knowledge index has not been populated. It has been validated by manual review of extracted fields, not by an automated suite.',
      results:
        'A complete design and code path from photo to masked, encrypted record to local question-answering. No OCR accuracy or volume numbers exist yet.',
      futureImprovements:
        'Real tests for each stage, a proper checksum implementation for the ID number format, and loading a real knowledge base are the clearest next steps before this handles real documents.'
    }
  }
];

export const TECH_STACK: TechCategoryData[] = [
  { name: 'AI / ML', subtitle: 'Building intelligent systems for real-world impact', icon: 'brain', items: ['Generative AI', 'LLM Systems', 'RAG', 'NLP', 'Machine Learning', 'Deep Learning', 'Agentic AI', 'Real-Time Voice AI', 'Prompt Engineering'] },
  { name: 'Voice AI', subtitle: 'Real-time speech pipelines that feel like a conversation', icon: 'mic', items: ['Pipecat', 'Twilio Media Streams', 'Silero / WebRTC VAD', 'Sarvam AI', 'Deepgram', 'ElevenLabs', 'Cartesia', 'Azure Speech'] },
  { name: 'LLMs & Agentic', subtitle: 'Multi-provider orchestration and tool-calling workflows', icon: 'sparkles', items: ['OpenAI', 'Anthropic Claude', 'Google Gemini', 'Groq', 'Mistral', 'DeepSeek', 'Ollama', 'MCP', 'Function Calling', 'Structured Outputs', 'n8n'] },
  { name: 'Backend & APIs', subtitle: 'Production services that run reliably at scale', icon: 'server', items: ['Python', 'FastAPI', 'Flask', 'REST APIs', 'WebSockets', 'Server-Sent Events', 'AsyncIO', 'C#', '.NET', 'ASP.NET Core'] },
  { name: 'Data', subtitle: 'Storage, processing, and fast reliable retrieval', icon: 'database', items: ['PostgreSQL', 'MySQL', 'Redis', 'SQLite', 'Pandas', 'RapidFuzz', 'NumPy', 'Scikit-learn', 'sentence-transformers', 'FAISS', 'FinBERT'] },
  { name: 'Infra & DevOps', subtitle: 'Shipping, monitoring, and scaling what gets built', icon: 'cpu', items: ['Docker', 'Docker Compose', 'Git', 'Linux', 'CI/CD', 'Prometheus', 'Grafana', 'AWS (S3)', 'Azure'] }
];

export const ENGINEERING_CONCEPTS = [
  'API Design',
  'Authentication',
  'Business Logic',
  'Data Processing',
  'Service Architecture',
  'Error Handling',
  'Logging',
  'Integration'
];
