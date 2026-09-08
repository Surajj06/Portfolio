export interface CaseStudySection {
  heading: string;
  body: string;
}

export interface Project {
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
