import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { TechCategory } from '../../models/tech.model';
import { Project } from '../../models/project.model';
import { IconComponent } from '../icons/icon.component';

interface SkillSelection {
  category: string;
  item: string;
}

/**
 * Each tech category renders as a small hub-and-spoke graph (a category hub
 * with its individual tools/techniques as surrounding nodes) instead of a
 * plain chip list or a percentage/star rating — this content doesn't carry
 * the precision a score implies. Selecting a node shows what it's actually
 * used for by cross-referencing `PortfolioDataService.projects[].techStack`
 * directly — a real link back to shipped work, not an invented proficiency
 * number.
 */
@Component({
  selector: 'app-skill-graph',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './skill-graph.component.html',
  styleUrl: './skill-graph.component.scss'
})
export class SkillGraphComponent implements AfterViewInit, OnDestroy {
  readonly categories: TechCategory[];
  selected: SkillSelection | null = null;
  usedIn: Project[] = [];

  private scrollTrigger?: ScrollTrigger;

  constructor(
    private readonly data: PortfolioDataService,
    private readonly el: ElementRef<HTMLElement>
  ) {
    this.categories = this.data.techStack;
  }

  /** Even angular spread around the hub, starting at the top (-90deg). */
  nodeAngle(index: number, count: number): number {
    return (360 / count) * index - 90;
  }

  // Denser categories (more items, e.g. LLMs & Agentic with 10) get a
  // slightly larger radius so adjacent node pills — sized to fit their own
  // label text — have more arc length between them and don't overlap.
  private nodeRadius(count: number): number {
    return 92 + Math.max(0, count - 6) * 4;
  }

  nodeX(index: number, count: number, radius = this.nodeRadius(count)): number {
    return 110 + radius * Math.cos((this.nodeAngle(index, count) * Math.PI) / 180);
  }

  nodeY(index: number, count: number, radius = this.nodeRadius(count)): number {
    return 110 + radius * Math.sin((this.nodeAngle(index, count) * Math.PI) / 180);
  }

  // Same coordinate space as the 0-220 SVG viewBox (see the template), just
  // expressed as a percentage so the HTML node buttons (which need to be
  // real focusable elements, not SVG shapes) line up with the SVG spokes.
  nodeXPct(index: number, count: number): number {
    return (this.nodeX(index, count) / 220) * 100;
  }

  nodeYPct(index: number, count: number): number {
    return (this.nodeY(index, count) / 220) * 100;
  }

  isActive(category: TechCategory, item: string): boolean {
    return this.selected?.category === category.name && this.selected?.item === item;
  }

  selectItem(category: TechCategory, item: string): void {
    if (this.isActive(category, item)) {
      this.selected = null;
      this.usedIn = [];
      return;
    }
    this.selected = { category: category.name, item };
    this.usedIn = this.data.projects.filter((project) => project.techStack.includes(item));
  }

  ngAfterViewInit(): void {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const clusters = this.el.nativeElement.querySelectorAll('.skill-cluster');

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.el.nativeElement,
      start: 'top 78%',
      once: true,
      onEnter: () => {
        gsap.from(clusters, {
          opacity: 0,
          y: 24,
          scale: 0.94,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power3.out'
        });
        clusters.forEach((cluster) => {
          const nodes = cluster.querySelectorAll('.skill-node, .skill-hub');
          gsap.from(nodes, {
            opacity: 0,
            scale: 0.5,
            duration: 0.45,
            stagger: 0.025,
            delay: 0.15,
            ease: 'back.out(1.7)'
          });
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollTrigger?.kill();
  }
}
