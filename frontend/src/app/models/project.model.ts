export interface CaseStudySection {
  heading: string;
  body: string;
}

/** Filter groups shown on the projects grid. A project can belong to several. */
export type ProjectCategory = 'AI / ML' | 'Data' | 'Automation' | 'Backend & Full-stack';

/** Colour used for a project's generated cover art and highlights. */
export type ProjectAccent = 'lime' | 'violet' | 'sky' | 'coral' | 'pink' | 'amber' | 'mint';

/** A headline fact about a project. Every value must come from the case study text. */
export interface Highlight {
  value: string;
  label: string;
}

/** The authored content of a project (see PortfolioDataService). */
export interface ProjectBase {
  id: string;
  index: string; // e.g. "01"
  title: string;
  summary: string;
  description: string;
  concepts: string[];
  techStack: string[];
  workflowSteps: string[];
  screenshotUrl: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  /** A small in-browser version of the project's real logic, shown on its case-study page. */
  demo?: { heading: string; intro: string };
  caseStudy: {
    problem: string;
    whyItWasDifficult: string;
    architecture: string;
    technicalApproach: string;
    implementation: string;
    challenges: string;
    solution: string;
    evaluation: string;
    results: string;
    futureImprovements: string;
  };
}

/** Presentation metadata layered on top of the authored content. */
export interface ProjectMeta {
  categories: ProjectCategory[];
  accent: ProjectAccent;
  highlights: Highlight[];
}

export type Project = ProjectBase & ProjectMeta;
