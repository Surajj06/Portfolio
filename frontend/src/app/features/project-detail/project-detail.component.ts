import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icons/icon.component';
import { RevealDirective } from '../../shared/reveal/reveal.directive';
import { WorkflowDiagramComponent } from '../../shared/workflow-diagram/workflow-diagram.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { Project } from '../../models/project.model';

interface CaseStudyRow {
  index: string;
  heading: string;
  body: string;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, RevealDirective, WorkflowDiagramComponent],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent implements OnInit {
  project?: Project;
  rows: CaseStudyRow[] = [];

  constructor(private readonly route: ActivatedRoute, readonly data: PortfolioDataService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.project = id ? this.data.getProjectById(id) : undefined;

    if (this.project) {
      const cs = this.project.caseStudy;
      this.rows = [
        { index: '01', heading: 'Problem', body: cs.problem },
        { index: '02', heading: 'Why it was difficult', body: cs.whyItWasDifficult },
        { index: '03', heading: 'Architecture', body: cs.architecture },
        { index: '04', heading: 'Technical approach', body: cs.technicalApproach },
        { index: '05', heading: 'Implementation', body: cs.implementation },
        { index: '06', heading: 'Challenges', body: cs.challenges },
        { index: '07', heading: 'Solution', body: cs.solution },
        { index: '08', heading: 'Evaluation', body: cs.evaluation },
        { index: '09', heading: 'Results', body: cs.results },
        { index: '10', heading: 'Future improvements', body: cs.futureImprovements }
      ];
    }
  }
}
