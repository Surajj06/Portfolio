import { Injectable } from '@angular/core';
import { Project } from '../models/project.model';
import { ExperienceEntry } from '../models/experience.model';
import { TechCategory } from '../models/tech.model';
import { IconName } from '../shared/icons/icon.component';
import {
  ABOUT,
  APPROACH,
  BASE_PROJECTS,
  ENGINEERING_CONCEPTS,
  EXPERIENCE,
  PROFILE,
  PROJECT_META,
  STATS,
  TECH_STACK
} from '../data/portfolio-content';

export interface NavItem {
  label: string;
  id: string;
  icon: IconName;
}

export interface PipelineStep {
  id: string;
  title: string;
  icon: IconName;
  detail: string;
}

export type CallRole = 'agent' | 'caller' | 'system';

export interface CallLine {
  role: CallRole;
  text: string;
  /** Pipeline step (index into `pipeline`) that is "active" while this line plays. */
  step: number;
  tag?: string;
}

/**
 * What the templates read. The portfolio's copy itself (profile, experience,
 * projects + case studies, tech stack) lives in ../data/portfolio-content.ts —
 * a plain-data module shared with the chat assistant so both always agree.
 * UI-specific bits (nav, marquee, pipeline, demo call script) stay here.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioDataService {
  readonly profile = PROFILE;

  /** Section navigation. `dock: true` items appear in the mobile bottom dock. */
  readonly nav: (NavItem & { dock?: boolean; desktop?: boolean })[] = [
    { label: 'Home', id: 'top', icon: 'home', dock: true },
    { label: 'About', id: 'about', icon: 'user', dock: true, desktop: true },
    { label: 'Experience', id: 'experience', icon: 'briefcase', desktop: true },
    { label: 'Work', id: 'projects', icon: 'grid', dock: true, desktop: true },
    { label: 'Skills', id: 'skills', icon: 'cpu', dock: true, desktop: true },
    { label: 'Systems', id: 'systems', icon: 'layers', desktop: true },
    { label: 'Contact', id: 'contact', icon: 'send', dock: true, desktop: true }
  ];

  /** Big-number strip under the hero — each figure is quoted from a case study. */
  readonly stats = STATS;

  /** Curated ticker content — a high-signal slice of the full stack below. */
  readonly marqueeItems = [
    'Generative AI', 'LLM Orchestration', 'RAG', 'Agentic AI', 'MCP', 'Ollama', 'Function Calling', 'Structured Outputs', 'Real-Time Voice AI',
    'Python', 'FastAPI', 'C# / .NET', 'Angular', 'PostgreSQL', 'Redis', 'Docker',
    'OpenAI', 'Anthropic Claude', 'Google Gemini', 'Groq', 'n8n', 'Prometheus + Grafana'
  ];

  /**
   * How a call moves through the voice platform (project 01). Each detail is
   * paraphrased from that case study's architecture / approach / solution text.
   */
  readonly pipeline: PipelineStep[] = [
    {
      id: 'connect',
      title: 'Call connects',
      icon: 'phone',
      detail:
        'The call audio streams in over Twilio, Plivo, Exotel or carrier SIP, and the engine opens a live session for that call: its assistant, voice, knowledge documents and tools.'
    },
    {
      id: 'clean',
      title: 'VAD + turn detection',
      icon: 'wave',
      detail:
        'Silero VAD detects when the caller is actually speaking, Smart Turn decides when a sentence is really finished, and noise suppression cleans the phone line. The bot waits about 0.7 s of quiet before it answers, so it never talks over someone mid-sentence.'
    },
    {
      id: 'stt',
      title: 'Speech-to-text',
      icon: 'mic',
      detail:
        'Streaming speech-to-text (Sarvam by default, with nine other providers available) converts the caller’s audio into text in real time and hands it to the LLM.'
    },
    {
      id: 'brain',
      title: 'LLM + knowledge',
      icon: 'brain',
      detail:
        'A written prompt drives every turn: the LLM decides what to say and which tool to call (end the call, schedule a callback, look something up in the assistant’s own documents). It answers only from those documents and never guesses what it was not given.'
    },
    {
      id: 'tts',
      title: 'Text-to-speech',
      icon: 'sparkles',
      detail:
        'The reply is synthesized and streamed back to the caller. A pronunciation dictionary keeps Indian names and terms intelligible across regional languages.'
    },
    {
      id: 'live',
      title: 'Live dashboard update',
      icon: 'layers',
      detail:
        'The multi-tenant control-plane dashboard (Angular + .NET) shows the call live. It only ever talks to the voice engine and API — never to telephony or AI providers directly.'
    }
  ];

  /** Shown under the pipeline: the resilience story behind every stage. */
  readonly pipelineNote =
    'Every external provider can fail over: provider health is tracked from real call outcomes, and a struggling speech or LLM provider is switched out automatically — even mid-call for the LLM — instead of taking calls down.';

  /** Facts for the Systems tiles (all from the voice platform case study). */
  readonly systemFacts = [
    { value: '1.1s', label: 'measured: caller stops → first agent audio' },
    { value: '13', label: 'LLM providers, auto-failover' },
    { value: '30+', label: 'provider integrations: STT, TTS, LLM, telephony' },
    { value: '4,000+', label: 'automated Python tests' }
  ];

  /**
   * ILLUSTRATIVE conversation for the Systems demo card — written to show the
   * pipeline stages in motion. It is not a recording of a real call and the
   * UI labels it as such.
   */
  readonly callScript: CallLine[] = [
    { role: 'system', text: 'Call connected', step: 0, tag: 'Twilio' },
    { role: 'agent', text: 'Hello! I’m calling about your vehicle insurance renewal. Is this a good time?', step: 4, tag: 'TTS' },
    { role: 'caller', text: 'Yes, go ahead.', step: 2, tag: 'STT' },
    { role: 'system', text: 'The LLM decides the reply from the written prompt', step: 3, tag: 'LLM' },
    { role: 'agent', text: 'Great. Your renewal quote is ready. Would you like me to walk you through it?', step: 4, tag: 'TTS' },
    { role: 'caller', text: 'Why did the premium change from last year?', step: 2, tag: 'STT' },
    { role: 'system', text: 'The LLM answers from the assistant’s own knowledge documents', step: 3, tag: 'LLM + knowledge' },
    { role: 'agent', text: 'Good question. Let me explain what changed on your policy this year.', step: 4, tag: 'TTS' },
    { role: 'system', text: 'Dashboard updated live', step: 5, tag: 'Live' }
  ];

  readonly about = ABOUT;

  readonly approach = APPROACH;

  readonly experience: ExperienceEntry[] = EXPERIENCE;

  // githubUrl/liveUrl are null across the board — these are employer-owned
  // private codebases, not open-source repos with public links.
  // (The authored content lives in ../data/portfolio-content.ts.)

  /** Authored content merged with its presentation metadata (see PROJECT_META). */
  readonly projects: Project[] = BASE_PROJECTS.map((project) => ({ ...project, ...PROJECT_META[project.id] }));

  readonly techStack = TECH_STACK as TechCategory[];

  readonly engineeringConcepts = ENGINEERING_CONCEPTS;

  getProjectById(id: string): Project | undefined {
    return this.projects.find((project) => project.id === id);
  }
}
