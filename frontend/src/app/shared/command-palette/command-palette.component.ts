import { Component, ElementRef, HostListener, Signal, ViewChild, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../icons/icon.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService } from '../../services/theme.service';
import { CommandPaletteService } from './command-palette.service';

interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  group: 'Sections' | 'Projects' | 'Actions';
  run: () => void;
}

/**
 * Ctrl/Cmd+K quick-jump overlay — search across page sections, projects, and
 * a couple of common actions (theme toggle, resume). Mounted once at the app
 * root (see app.component.html). Keyboard events are low-frequency, so
 * unlike the mousemove/scroll listeners elsewhere, there's no need to run
 * this outside Angular's zone.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss'
})
export class CommandPaletteComponent {
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  readonly activeIndex = signal(0);

  private readonly sectionCommands: PaletteCommand[];
  private readonly projectCommands: PaletteCommand[];
  private readonly allCommands: Signal<PaletteCommand[]>;
  readonly filtered: Signal<PaletteCommand[]>;

  constructor(
    readonly palette: CommandPaletteService,
    private readonly router: Router,
    private readonly data: PortfolioDataService,
    private readonly theme: ThemeService
  ) {
    const sections: Array<{ label: string; fragment: string }> = [
      { label: 'Home', fragment: 'top' },
      { label: 'About', fragment: 'about' },
      { label: 'Experience', fragment: 'experience' },
      { label: 'Projects', fragment: 'projects' },
      { label: 'Skills', fragment: 'skills' },
      { label: 'Systems', fragment: 'systems' },
      { label: 'Contact', fragment: 'contact' }
    ];

    this.sectionCommands = sections.map((section) => ({
      id: `section-${section.fragment}`,
      label: section.label,
      hint: 'Section',
      group: 'Sections',
      run: () => this.router.navigate(['/'], { fragment: section.fragment })
    }));

    this.projectCommands = this.data.projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.title,
      hint: 'Project',
      group: 'Projects',
      run: () => this.router.navigate(['/projects', project.id])
    }));

    // Recomputed on every access so the theme-toggle label reflects the
    // *current* theme, not whatever it was when the palette first mounted.
    this.allCommands = computed<PaletteCommand[]>(() => {
      const actionCommands: PaletteCommand[] = [
        {
          id: 'action-theme',
          label: `Switch to ${this.theme.theme() === 'dark' ? 'light' : 'dark'} mode`,
          hint: 'Toggle theme',
          group: 'Actions',
          run: () => this.theme.toggle()
        },
        {
          id: 'action-resume',
          label: 'Download resume',
          hint: 'PDF',
          group: 'Actions',
          run: () => window.open(this.data.profile.resumePath, '_blank')
        },
        {
          id: 'action-email',
          label: `Email ${this.data.profile.name}`,
          hint: this.data.profile.email,
          group: 'Actions',
          run: () => (window.location.href = `mailto:${this.data.profile.email}`)
        }
      ];
      return [...this.sectionCommands, ...this.projectCommands, ...actionCommands];
    });

    this.filtered = computed(() => {
      const q = this.query().trim().toLowerCase();
      const all = this.allCommands();
      if (!q) return all;
      return all.filter((cmd) => cmd.label.toLowerCase().includes(q) || cmd.group.toLowerCase().includes(q));
    });

    // Single source of truth for "just opened" behavior, regardless of
    // whether it was triggered by Ctrl+K or the navbar's search button.
    // allowSignalWrites: this effect's only job is resetting other signals
    // in response to isOpen flipping true — it never reads its own writes,
    // so there's no risk of the loop this guard normally protects against.
    effect(
      () => {
        if (!this.palette.isOpen()) return;
        this.query.set('');
        this.activeIndex.set(0);
        setTimeout(() => this.searchInputRef?.nativeElement.focus(), 0);
      },
      { allowSignalWrites: true }
    );
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const isOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (isOpenShortcut) {
      event.preventDefault();
      this.palette.toggle();
      return;
    }

    if (!this.palette.isOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.runActive();
    }
  }

  close(): void {
    this.palette.close();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onBackdropClick(): void {
    this.close();
  }

  select(index: number): void {
    this.activeIndex.set(index);
  }

  runCommand(command: PaletteCommand): void {
    this.close();
    command.run();
  }

  private move(delta: number): void {
    const count = this.filtered().length;
    if (!count) return;
    this.activeIndex.update((i) => (i + delta + count) % count);
  }

  private runActive(): void {
    const items = this.filtered();
    const command = items[this.activeIndex()];
    if (command) this.runCommand(command);
  }
}
