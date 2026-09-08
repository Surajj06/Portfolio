import { Injectable } from '@angular/core';
import { Project } from '../models/project.model';
import { ExperienceEntry } from '../models/experience.model';
import { TechCategory } from '../models/tech.model';

/**
 * Single source of truth for editable portfolio content. Nothing here is
 * fabricated — durations, results, and companies are placeholders until
 * Suraj supplies the real values. Update this file to change the site's copy.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioDataService {
  readonly profile = {
    name: 'Suraj Deepak Jha',
    role: 'AI Engineer',
    tagline: 'AI Engineer | Voice AI | LLM Systems',
    email: 'surajjha462002@gmail.com',
    phone: '+91 9867751859',
    github: 'https://github.com/Surajj06',
    linkedin: 'https://www.linkedin.com/in/suraj-jha-638991225/',
    instagram: 'https://www.instagram.com/_surajj06/' as string | null,
    photoUrl: '/assets/profile.png' as string | null,
    resumePath: '/assets/resume.pdf',
    status: 'Building with AI + .NET',
    // Rotating hero identity line — each one maps directly to a techStack
    // category or the experience entry below, not an invented title.
    heroIdentities: ['AI Engineer', 'Voice AI Builder', 'LLM Systems Engineer', 'Automation Builder']
  };

  readonly about = {
    summary:
      'I\'m an AI Engineer specializing in Generative AI, LLM systems, and real-time Voice AI, with production experience building scalable AI applications for the insurance domain — including a voice calling platform handling 20,000+ calls a day. My work spans LLM orchestration, RAG, agentic workflows, and the real-time speech and backend engineering needed to run them reliably at scale.',
    focusAreas: [
      'Generative AI',
      'Large Language Models',
      'Real-Time Voice AI',
      'RAG',
      'Agentic AI',
      'Prompt Engineering',
      'MCP (Model Context Protocol)',
      'Python',
      'FastAPI',
      'Microservices',
      'Data Processing',
      'Production AI Systems'
    ]
  };

  readonly approach = [
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

  readonly experience: ExperienceEntry[] = [
    {
      role: 'AI Engineer',
      company: 'Probus Insurance Broker Private Limited',
      duration: 'Aug 2025 — Present',
      description:
        'Building production AI systems for the insurance domain — a real-time voice calling platform, multi-provider LLM orchestration, vehicle-data automation pipelines, and MCP-based agentic workflows.',
      responsibilities: [
        'Architected and deployed a production AI voice calling agent handling 20,000+ outbound calls/day for insurance policy renewals, with a real-time STT → VAD → LLM → TTS pipeline and sub-second turn latency.',
        'Built a provider-agnostic LLM orchestration layer spanning multiple providers (OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, DeepSeek, and others) with automatic health-based failover and live mid-call provider switching.',
        'Developed vehicle data mapping and normalization pipelines with rule-based scoring and insurance-domain validation logic for GCV and PCV quotation workflows.',
        'Designed MCP server architectures and n8n automation pipelines orchestrating LLMs, REST APIs, and PostgreSQL/Redis databases into scalable production workflows.',
        'Built RESTful microservices with FastAPI and Flask; automated data extraction from 74+ insurance partner portals using Selenium and async HTTP with rate-limit-safe execution.',
        'Operated production AI systems serving thousands of daily user interactions with high availability, using async circuit breakers, Redis-based distributed state, and Prometheus + Grafana observability.'
      ],
      technologies: ['Python', 'FastAPI', 'Pipecat', 'Twilio', 'OpenAI', 'Anthropic Claude', 'Google Gemini', 'PostgreSQL', 'Redis', 'Docker', 'C#', '.NET', 'Angular'],
      contributions: [
        'Provider-agnostic multi-LLM orchestration layer with automatic failover, used across the voice platform and internal automation workflows.',
        'Vehicle data mapping pipeline that directly powers the company\'s GCV/PCV quotation portal.'
      ]
    }
  ];

  // githubUrl/liveUrl are null across the board — these are employer-owned
  // private codebases, not open-source repos with public links.
  readonly projects: Project[] = [
    {
      id: 'ai-voice-calling-platform',
      index: '01',
      title: 'AI Voice Calling Platform',
      summary: 'A production voice AI agent handling 20,000+ outbound calls a day, with multi-LLM failover and a live monitoring dashboard.',
      description:
        'A production AI voice calling agent handling 20,000+ outbound calls a day for insurance policy renewals — a real-time STT → VAD → LLM → TTS pipeline with sub-second turn latency, multi-provider LLM failover, and a multi-tenant monitoring dashboard.',
      concepts: ['Voice AI', 'Real-Time Systems', 'Telephony', 'LLM Orchestration', 'Multi-Provider Failover', 'RAG'],
      techStack: ['Python', 'Pipecat', 'FastAPI', 'Twilio', 'Sarvam AI', 'OpenAI', 'Anthropic Claude', 'Google Gemini', 'Groq', 'Mistral', 'DeepSeek', 'Silero VAD', 'DeepFilterNet', 'PostgreSQL', 'Redis', 'C#', '.NET', 'Angular', 'Docker', 'Prometheus', 'Grafana'],
      workflowSteps: ['Call connects', 'Noise suppression + VAD', 'Speech-to-text', 'State machine / LLM + RAG', 'Text-to-speech', 'Live dashboard update'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'A production AI voice agent for outbound insurance policy renewal calls at scale — 20,000+ calls a day — holding a natural, real-time conversation with sub-second turn latency, plus a multi-tenant staff dashboard for monitoring and control.',
        whyItWasDifficult:
          'Sub-second turn latency on real telephony audio leaves very little room for a slow model call, at a call volume where any systemic slowdown compounds fast. On top of that: keeping the conversation flowing over a lossy phone audio path in noisy real-world environments, correctly pronouncing a wide range of Indian names across regional languages, staying compliant with do-not-call and calling-hours regulations, and integrating enough independent providers (telephony, speech-to-text, text-to-speech, and multiple LLMs) that any single one failing should not take calls down at that scale.',
        architecture:
          'The call audio stream flows from Twilio through Silero VAD and DeepFilterNet noise suppression, streaming speech-to-text, a conversation layer that resolves most turns deterministically and escalates the rest to an LLM (backed by a per-bot RAG pipeline over PostgreSQL), then text-to-speech back to the caller. The voice engine is a separate service from the multi-tenant control-plane dashboard — the dashboard never talks to telephony or AI providers directly, only through the engine — and pushes live monitoring updates to connected browsers in real time.',
        technicalApproach:
          'A deterministic state machine resolves roughly 80% of conversation turns without touching an LLM at all, at under 50ms — which is what makes the sub-second latency target achievable at this call volume; only genuinely off-script utterances escalate to the LLM. The LLM layer itself is provider-agnostic across OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, and DeepSeek, with automatic health-based failover and the ability to switch providers mid-call. The RAG pipeline uses OpenAI embeddings with cosine-similarity retrieval over PostgreSQL-backed knowledge bases, with source documents stored in S3.',
        implementation:
          'Production resilience is built in at every layer: async circuit breakers around each external provider, an answering-machine-detection gate, TRAI-compliant do-not-call enforcement, and a custom phonetics module covering 500+ names for correct pronunciation across Indian regional languages. Prompts are structured as an explicit call state machine plus a Hindi objection-handling playbook and anti-hallucination guardrails, refined iteratively from real call recordings. The control-plane dashboard is a multi-tenant Angular + .NET application with role-based access control, audit trails, and a function-calling tool framework, deployed via Docker with multi-worker scaling.',
        challenges:
          'The first few seconds of a call are the highest-risk window — if the pipeline needs time to initialize, the caller hears dead air, which reads as a dropped call. Running this at 20,000+ calls a day also means a single misbehaving provider or a quietly degrading fallback path can affect a large number of real customers before anyone notices.',
        solution:
          'A short greeting is pre-synthesized and played immediately on connect, so the caller hears something natural while the rest of the pipeline finishes initializing in the background. Every external provider call is wrapped in a circuit breaker so a struggling STT, TTS, or LLM provider degrades gracefully — failing over automatically — instead of taking calls down, and explicit startup validation checks catch misconfiguration before it can reach a live call.',
        evaluation:
          'An automated test suite covers the voice engine, with component health checks exposed per provider and structured logging throughout. Prompt behavior is refined iteratively against real call recordings rather than tuned once and left alone.',
        results:
          '20,000+ outbound calls handled per day in production, with sub-second turn latency and a deterministic fast-path resolving roughly 80% of turns in under 50ms. Uptime and cost figures are not published here — ask Suraj if he wants specific numbers included.',
        futureImprovements:
          'The deterministic fast-path and phonetics module are both designed to keep improving with more real-call data rather than being tuned once and left static.'
      }
    },
    {
      id: 'vehicle-catalogue-matching-engine',
      index: '02',
      title: 'Vehicle Catalogue Matching Engine',
      summary: 'A fuzzy-matching pipeline that standardizes vehicle master data across 15+ insurance partners, powering the company\'s quotation portal.',
      description:
        'An end-to-end vehicle master data standardization pipeline processing thousands of records across 15+ insurance partners (HDFC, TATA, ICICI, Bajaj, Digit, SBI, and others), directly powering the company\'s GCV/PCV quotation portal — replacing a manual Excel-matching process that used to take days per partner.',
      concepts: ['Data Engineering', 'Fuzzy Matching', 'Data Reconciliation', 'Automation', 'ETL'],
      techStack: ['Python', 'pandas', 'rapidfuzz', 'PostgreSQL', 'openpyxl', 'NumPy'],
      workflowSteps: ['Load catalogue + partner files', 'Normalize make/model/fuel/GVW', 'Group by normalized make', 'Multi-field rule gates', 'Confidence scoring', 'Feed quotation portal + audit trail'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'The company\'s internal vehicle catalogue needed to be reconciled against catalogues from 15+ insurance partners (HDFC, TATA, ICICI, Bajaj, Digit, SBI, and others), each using different naming conventions, so every vehicle could be linked to the right product line for premium generation — previously done by hand in Excel.',
        whyItWasDifficult:
          'Every partner encodes the same vehicle differently: different make spellings, fuel type as text vs. letter codes vs. numeric codes, gross vehicle weight rounded differently, model names sometimes sitting in the wrong column entirely. Naively comparing every internal row against every partner row is quadratic — for a single mid-sized partner file, a full cross-join runs well into the hundreds of millions of comparisons, which is not something you can run repeatedly by hand or brute-force in code. On top of that, this pipeline is not just a reporting tool — it directly feeds the quotation portal, so a bad match means a wrong premium quote.',
        architecture:
          'Rows are first grouped by a normalized make name, which cuts the comparison space by roughly four orders of magnitude before any matching starts. Within each group, candidate pairs pass through multi-field rule gates — vehicle type, fuel, gross vehicle weight, and others — where failing any single gate is an automatic reject regardless of how similar the text looks. Pairs that clear every gate get fuzzy-scored on make, model, and variant text and assigned a cross-field confidence score. Modular, per-insurer matching engines write standardized output into PostgreSQL with a full audit trail.',
        technicalApproach:
          'Matching uses rapidfuzz string similarity — a plain ratio for make names, a token-set ratio for model names so word order and extra tokens do not break a match, and a token-sort ratio for variant text. Partner-specific quirks (numeric type codes, oddly-encoded weight fields, model names in the wrong column) are handled by small, partner-specific preprocessing functions rather than one tangled set of general-purpose rules, which keeps each partner\'s edge cases isolated and easy to reason about independently.',
        implementation:
          'Each partner runs through its own modular matching engine sharing the same core pipeline, writing to a standardized PostgreSQL schema with an audit trail for every match decision. The same architecture was extended across both GCV and PCV vehicle categories by swapping in a new partner configuration, not by rewriting the matching logic.',
        challenges:
          'One partner recorded a fleet vehicle\'s actual rated weight, where the internal catalogue used a single standardized weight for that whole vehicle class — which quietly suppressed matches across an entire segment.',
        solution:
          'Rather than special-casing that one partner, the fix was generalized into a rule applied to any partner showing the same standardization pattern, which recovered matches across several other partners with the identical issue and pushed the match rate for that problem segment from roughly 50% into the high 50s.',
        evaluation:
          'Matching quality is validated by inspecting match counts and the unmatched/review sheets after each run against known partner files, backed by the PostgreSQL audit trail for traceability on every decision. An automated regression suite is a documented next step, not something that exists yet.',
        results:
          'Processes thousands of vehicle records across 15+ insurance partners on one shared codebase, and directly powers premium generation on the company\'s GCV and PCV quotation lines. A reconciliation run that used to take a person days per partner now completes in minutes. Exact accuracy figures are not published here — ask Suraj if he wants specific numbers included.',
        futureImprovements:
          'Parallelizing matching across make-groups, moving partner onboarding from code changes to configuration files, and adding an automated regression test suite are the clearest next steps.'
      }
    },
    {
      id: 'conversational-quote-assistant',
      index: '03',
      title: 'Conversational Quote Assistant',
      summary: 'A chat-based front end that replaces a multi-field insurance quote form with a guided conversation.',
      description:
        'A chat-based front end that replaces a multi-field insurance quote form with a guided, step-by-step conversation, calling the exact same backend the original web form uses.',
      concepts: ['Conversational UX', 'State Machines', 'API Integration', 'Session Management'],
      techStack: ['Python', 'Flask', 'Flask-Session', 'Gunicorn', 'Docker'],
      workflowSteps: ['Collect vehicle + location details', 'Collect policy type + prior policy info', 'Check eligible partners', 'Fetch a quote per partner', 'Present results'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'Turn an existing multi-field two-wheeler insurance quote form into a step-by-step chat flow, without changing the backend that actually generates quotes.',
        whyItWasDifficult:
          'The conversation has real branching logic — whether the customer has a prior policy changes which follow-up questions appear, and how long ago that policy lapsed changes which quote type gets requested. Free-text vehicle input has to resolve to the exact structured record the backend expects, and one partner\'s API failing should not block quotes from the others.',
        architecture:
          'A Flask app tracks conversation progress as a named step in a server-side session, with a step-to-handler dispatch table driving what gets asked next. Once enough details are collected, it checks which partners are eligible to quote this vehicle, then calls each eligible partner in turn for a price.',
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
          'Not documented — ask Suraj for real numbers (completion rate, quote turnaround) if he wants them included.',
        futureImprovements:
          'There is a clear, already-scoped extension path: adding a private-car product by adding its vehicle data and swapping the payload shape, and reusing the same chat pattern for the other vehicle categories the matching engine above covers.'
      }
    },
    {
      id: 'whatsapp-document-verification-bot',
      index: '04',
      title: 'WhatsApp Document Verification Bot',
      summary: 'A privacy-first WhatsApp bot that extracts and validates fields from photographed ID documents, with encrypted storage.',
      description:
        'A privacy-first WhatsApp bot that extracts and validates fields from photographed ID documents, stores them encrypted, and answers follow-up questions through a local vector search layer that never sends document content to an external LLM.',
      concepts: ['OCR', 'Document Processing', 'Privacy Engineering', 'Vector Search', 'Encryption'],
      techStack: ['Python', 'FastAPI', 'PostgreSQL', 'Tesseract OCR', 'OpenCV', 'sentence-transformers', 'FAISS', 'cryptography (Fernet/AES)', 'Docker'],
      workflowSteps: ['Receive document via WhatsApp', 'Preprocess image', 'OCR + field extraction', 'Validate + mask PII', 'Encrypt + store', 'Answer questions via local vector search'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'Customers send ID documents as photos over WhatsApp for verification. The bot extracts the relevant fields, validates them, and can answer follow-up questions from the extracted data — without the document or any extracted personal information ever leaving the system through an external API.',
        whyItWasDifficult:
          'Photos taken by customers are inconsistent — skewed, poorly lit, low resolution — which makes OCR unreliable without real preprocessing. Because the documents are government ID, encryption and PII masking had to be first-class design decisions from the start, not added later. Answering questions from the extracted data without calling an external LLM also meant building retrieval entirely locally.',
        architecture:
          'A WhatsApp Cloud API webhook receives incoming documents, downloads the media, and hands it to an image-preprocessing step (grayscale, denoise, deskew, threshold) before OCR. Extracted text runs through field extraction and validation, then the original file is encrypted and the plaintext copy is deleted. A separate local embedding index lets the bot answer questions against stored knowledge without any external LLM call.',
        technicalApproach:
          'Every stored file and sensitive field is encrypted at rest, with masking functions that only ever echo back a redacted form of sensitive data in bot replies. Because the question-answering embeddings are generated and searched locally, no document content needs to leave the server to answer a follow-up question.',
        implementation:
          'A FastAPI service backed by PostgreSQL, containerized with Docker Compose, with a separate lightweight admin interface for reviewing flagged extractions.',
        challenges:
          'Balancing OCR reliability against processing time on modest hardware — heavier preprocessing improves accuracy but costs latency.',
        solution:
          'Preprocessing is tuned to the minimum needed for consistent extraction rather than maximizing accuracy at any cost, and a configurable confidence threshold routes low-confidence extractions to manual review instead of auto-accepting them.',
        evaluation:
          'Test coverage for this project is still being built out — validated so far through manual review of extracted fields rather than a full automated suite.',
        results:
          'Not documented — ask Suraj for real figures if he wants OCR accuracy or volume numbers included.',
        futureImprovements:
          'Growing out the automated test suite is the clearest next step before this handles a larger volume of real documents.'
      }
    },
    {
      id: 'agent-gamification-platform',
      index: '05',
      title: 'Agent Gamification Platform',
      summary: 'A gamification and leaderboard platform for sales agents, with real-time scoring and team standings.',
      description:
        'A gamification platform for sales agents — regional teams compete over a season with a live leaderboard, tiers, achievements, and redeemable offers.',
      concepts: ['Real-Time Systems', 'Gamification', 'Role-Based Access Control'],
      techStack: ['C#', '.NET', 'ASP.NET Core', 'Entity Framework Core', 'SignalR', 'Angular', 'PostgreSQL'],
      workflowSteps: ['Sale verified', 'Score attributed to region/team', 'Standings recomputed', 'Live push to dashboard', 'Tier/achievement check'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'A gamified platform to drive sales-agent engagement — agents are grouped into regional teams that compete over a season, with a live leaderboard, tiers, achievements, and redeemable offers.',
        whyItWasDifficult:
          'Every verified sale needs to update a live leaderboard in real time and roll up into team standings without the leaderboard read path becoming a bottleneck as agents and sales grow. Access also needed three distinct roles — agent, admin, and master — with a two-level manager hierarchy layered on top.',
        architecture:
          'A .NET Web API backend (controllers, services, DTOs, an EF Core data layer) sits behind a SignalR hub that pushes typed real-time events — a sale, a tier upgrade, an updated leaderboard — to an Angular single-page app. One background service periodically recomputes live match scores from verified sales; another periodically snapshots the leaderboard for fast reads.',
        technicalApproach:
          'Leaderboard reads stay fast by maintaining running totals per agent and per team that update the moment a sale is verified, rather than aggregating from raw sales data on every page load. Role-based policies gate what each of the three user types can see and do.',
        implementation:
          'JWT-based auth with short-lived access tokens and longer-lived refresh tokens, plus password hashing and Swagger-documented endpoints throughout the API.',
        challenges:
          'SignalR client connections cannot always attach custom authorization headers, which conflicts with the header-based JWT scheme used everywhere else in the API.',
        solution:
          'The real-time hub accepts the JWT as a query-string parameter on its connection path specifically, while every other endpoint keeps standard header-based auth — a narrow, contained exception rather than weakening auth everywhere.',
        evaluation:
          'Not documented — no automated tests exist yet for this project.',
        results:
          'Not documented — ask Suraj for real engagement numbers if he wants them included.',
        futureImprovements:
          'The project currently runs against an in-memory database for local development, with a documented manual step to switch to a real production database as the clear next step.'
      }
    },
    {
      id: 'stock-intelligence-engine',
      index: '06',
      title: 'Stock Intelligence Engine',
      summary: 'A personal project: a local app that turns any Indian company name into a full stock report, built entirely on free data sources.',
      description:
        'A personal project — a local web app that turns any Indian company name into a structured stock report: price action, technical indicators, aggregated news, and an AI-generated summary, all from free data sources.',
      concepts: ['Personal Project', 'Data Pipelines', 'NLP', 'LLM Integration', 'Financial Data'],
      techStack: ['Python', 'FastAPI', 'PostgreSQL', 'SQLAlchemy', 'yfinance', 'nsepython', 'feedparser', 'sentence-transformers', 'FAISS', 'spaCy', 'FinBERT', 'APScheduler', 'OpenAI / Ollama'],
      workflowSteps: ['Resolve company to ticker', 'Pull price + news in parallel', 'Store in Postgres', 'Dedupe + embed for similarity', 'Generate AI summary', 'Serve dashboard'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'Get a full picture of an Indian public company — price action, technical indicators, aggregated news, and a plain-language summary — from one search box, without paying for a data subscription.',
        whyItWasDifficult:
          'No single free source covers everything: price history, technicals, and news each come from a different place, and news specifically means merging 11 separate RSS feeds that often republish overlapping stories under different headlines. Keeping the whole pipeline genuinely free meant treating the paid LLM step as optional rather than required.',
        architecture:
          'A company name resolves to a ticker, which fans out into parallel ingestion: price data and computed technicals on one side, RSS aggregation across 11 financial news sources on the other. Both land in PostgreSQL, after which an AI-analysis step reads the stored price and news data and generates structured summaries and key points, served through a FastAPI backend and a single-page dashboard.',
        technicalApproach:
          'Technicals are computed directly rather than pulled from a paid API — RSI-14 uses proper Wilder smoothing rather than a naive moving average, and the 50/200-day moving averages use standard rolling means. News deduplication hashes normalized headlines to drop exact repeats across feeds, while a separate embedding-based similarity layer goes further, matching genuinely similar historical events rather than just identical headlines. The LLM step is provider-agnostic — it runs against a paid API or a fully local free model interchangeably, so the tool works at zero ongoing cost if needed.',
        implementation:
          'A FastAPI backend with SQLAlchemy models, a scheduler that runs daily and weekly ingestion jobs automatically, and prompts constrained to only cite numbers that are actually present in the stored data rather than letting the model speculate.',
        challenges:
          'Free data sources are less reliable than paid ones — feeds go down, rate-limit, or return incomplete data.',
        solution:
          'The core dashboard is built to degrade gracefully — if one optional data source is unreachable, the rest of the report still renders instead of failing the whole request.',
        evaluation:
          'Not documented — no formal evaluation suite exists; this is a personal side project, not production software.',
        results:
          'Not documented — ask Suraj if he wants adoption or usage numbers included.',
        futureImprovements:
          'The project already has a background task queue configured but not yet wired up for heavier scheduled workloads — putting that to use is the clearest next step.'
      }
    },
    {
      id: 'api-health-monitor',
      index: '07',
      title: 'API Health Monitor',
      summary: 'An async platform concurrently monitoring 74+ insurance partner APIs, with status classification and multi-channel alerting.',
      description:
        'A real-time API health intelligence platform concurrently tracking 74+ insurance partner APIs, classifying their status (UP/DOWN/SLOW/ERROR), alerting across email, Slack, and Teams, and serving two live dashboards.',
      concepts: ['Observability', 'Async Programming', 'Reliability Engineering'],
      techStack: ['Python', 'asyncio', 'aiohttp', 'FastAPI', 'Streamlit', 'PostgreSQL', 'Prometheus', 'Docker'],
      workflowSteps: ['Load 74+ API list from config', 'Concurrent async health checks', 'Classify UP/SLOW/DOWN/ERROR', 'Alert via email/Slack/Teams', 'Serve FastAPI + Streamlit dashboards'],
      screenshotUrl: null,
      githubUrl: null,
      liveUrl: null,
      caseStudy: {
        problem:
          'Continuously monitor 74+ insurance partner APIs and surface their live status on a dashboard, instead of finding out about a partner outage from a support ticket.',
        whyItWasDifficult:
          'Checking 74+ endpoints on a schedule without overwhelming them or taking too long to notice a real outage required genuine concurrency, plus a classification scheme that distinguishes a truly down partner service from one that is just responding slowly — and alerting needed to fire on real state changes without drowning the team in noise.',
        architecture:
          'An async scheduler drives a concurrent health checker (Python asyncio + aiohttp), bounded by connection limits so it does not hammer any single partner, against an API list loaded dynamically from configuration. Each result is classified as UP, SLOW, DOWN, or ERROR based on status code and response time, feeding a multi-channel alerting layer (email, Slack, Teams) with smart state-change suppression, and two live dashboards — a FastAPI/SSE view and a Streamlit + Plotly view.',
        technicalApproach:
          'The API list is entirely config-driven — adding a new partner endpoint to monitor is a configuration change, not a code change. Per-API isolation, configurable timeouts, and exponential backoff retries keep one struggling partner from cascading into false alerts for everyone else, and state-change suppression means alerts fire on a real transition rather than on every failed check.',
        implementation:
          'Runs as a Docker Compose stack with its own PostgreSQL instance for history, Prometheus metrics for the underlying monitor\'s own health, and a daily retention-cleanup job so history does not grow unbounded.',
        challenges:
          'One failing partner API check should not take down the monitor itself, delay checks on every other partner, or trigger an alert storm.',
        solution:
          'Every check runs isolated inside its own error handling within the concurrent batch, exponential backoff smooths over transient blips before they escalate, and alerts only fire on an actual status-change transition rather than on every individual failed check.',
        evaluation:
          'Validated operationally against 74+ real partner endpoints in continuous use; an automated regression test suite is a documented next step.',
        results:
          'Concurrently tracks 74+ insurance partner APIs with two live dashboard views and multi-channel alerting in active use. Exact incident-detection or uptime figures are not published here — ask Suraj if he wants specific numbers included.',
        futureImprovements:
          'Rounding out the alerting integrations further and adding an automated regression test suite are the next steps.'
      }
    }
  ];

  readonly techStack: TechCategory[] = [
    { name: 'AI / ML', subtitle: 'Building intelligent systems for real-world impact', icon: 'brain', items: ['Generative AI', 'LLMs', 'RAG', 'NLP', 'Machine Learning', 'Deep Learning', 'Agentic AI', 'Real-Time Voice AI'] },
    { name: 'Voice AI', subtitle: 'Real-time speech pipelines that feel like a conversation', icon: 'mic', items: ['Pipecat', 'Twilio Media Streams', 'Silero / WebRTC VAD', 'Sarvam AI', 'Deepgram', 'ElevenLabs', 'Cartesia', 'Azure Speech'] },
    { name: 'LLMs & Agentic', subtitle: 'Multi-provider orchestration and tool-calling workflows', icon: 'sparkles', items: ['OpenAI', 'Anthropic Claude', 'Google Gemini', 'Groq', 'Mistral', 'DeepSeek', 'MCP', 'Function Calling', 'n8n', 'Prompt Engineering'] },
    { name: 'Backend & APIs', subtitle: 'Production services that run reliably at scale', icon: 'server', items: ['Python', 'FastAPI', 'Flask', 'REST APIs', 'WebSockets', 'AsyncIO', 'C#', '.NET', 'ASP.NET Core'] },
    { name: 'Data', subtitle: 'Storage, processing, and fast reliable retrieval', icon: 'database', items: ['PostgreSQL', 'MySQL', 'Redis', 'SQLite', 'Pandas', 'RapidFuzz', 'NumPy', 'Scikit-learn'] },
    { name: 'Infra & DevOps', subtitle: 'Shipping, monitoring, and scaling what gets built', icon: 'cpu', items: ['Docker', 'Docker Compose', 'Git', 'Linux', 'CI/CD', 'Prometheus', 'Grafana', 'AWS (S3)', 'Azure'] }
  ];

  readonly engineeringConcepts = [
    'API Design',
    'Authentication',
    'Business Logic',
    'Data Processing',
    'Service Architecture',
    'Error Handling',
    'Logging',
    'Integration'
  ];

  getProjectById(id: string): Project | undefined {
    return this.projects.find((project) => project.id === id);
  }
}
