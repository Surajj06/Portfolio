import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent, IconName } from '../icons/icon.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { SectionScrollService } from '../../services/section-scroll.service';
import { CommandPaletteService } from './command-palette.service';

interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  group: 'Sections' | 'Projects' | 'Actions';
  run: () => void;
}

/**
 * Ctrl/Cmd+K quick-jump: sections, projects and a few actions. Built on a
 * native <dialog> (modal) so focus trapping, Escape-to-close and inert
 * background come from the platform. On phones it's a bottom sheet.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss'
})
export class CommandPaletteComponent {
  @ViewChild('dialog', { static: true }) private readonly dialogRef!: ElementRef<HTMLDialogElement>;
  @ViewChild('search', { static: true }) private readonly searchRef!: ElementRef<HTMLInputElement>;

  readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly data = inject(PortfolioDataService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly sectionScroll = inject(SectionScrollService);

  readonly query = signal('');
  readonly active = signal(0);

  private readonly commands = computed<PaletteCommand[]>(() => {
    const sections = this.data.nav.map<PaletteCommand>((item) => ({
      id: `s-${item.id}`,
      label: item.label === 'Work' ? 'Projects' : item.label,
      hint: 'Section',
      icon: item.icon,
      group: 'Sections',
      run: () => this.sectionScroll.go(item.id)
    }));

    const projects = this.data.projects.map<PaletteCommand>((project) => ({
      id: `p-${project.id}`,
      label: project.title,
      hint: `Case study ${project.index}`,
      icon: 'arrow-up-right',
      group: 'Projects',
      run: () => this.router.navigate(['/projects', project.id])
    }));

    const actions: PaletteCommand[] = [
      {
        id: 'a-theme',
        label: `Switch to ${this.theme.theme() === 'dark' ? 'light' : 'dark'} mode`,
        hint: 'Theme',
        icon: this.theme.theme() === 'dark' ? 'sun' : 'moon',
        group: 'Actions',
        run: () => this.theme.toggle()
      },
      {
        id: 'a-resume',
        label: 'Download resume',
        hint: 'PDF',
        icon: 'download',
        group: 'Actions',
        run: () => this.downloadResume()
      },
      {
        id: 'a-copy',
        label: 'Copy email address',
        hint: this.data.profile.email,
        icon: 'copy',
        group: 'Actions',
        run: () => this.copyEmail()
      },
      {
        id: 'a-github',
        label: 'Open GitHub',
        hint: 'External',
        icon: 'github',
        group: 'Actions',
        run: () => window.open(this.data.profile.github, '_blank', 'noopener')
      },
      {
        id: 'a-linkedin',
        label: 'Open LinkedIn',
        hint: 'External',
        icon: 'linkedin',
        group: 'Actions',
        run: () => window.open(this.data.profile.linkedin, '_blank', 'noopener')
      }
    ];
    return [...sections, ...projects, ...actions];
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.commands();
    return q ? all.filter((c) => `${c.label} ${c.group} ${c.hint}`.toLowerCase().includes(q)) : all;
  });

  constructor() {
    // The signal is the source of truth; the dialog just follows it.
    effect(() => {
      const dialog = this.dialogRef.nativeElement;
      if (this.palette.isOpen()) {
        if (!dialog.open) {
          this.query.set('');
          this.active.set(0);
          dialog.showModal();
          this.searchRef.nativeElement.focus();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    }, { allowSignalWrites: true });
  }

  /** Native close (Escape key) → keep the signal in sync. */
  onNativeClose(): void {
    this.palette.close();
  }

  /** Clicks on the dialog element itself (outside the panel) are backdrop clicks. */
  onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) this.palette.close();
  }

  onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.filtered().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.active.update((i) => (i + 1) % count);
      this.scrollActiveIntoView();
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active.update((i) => (i - 1 + count) % count);
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = this.filtered()[this.active()];
      if (command) this.run(command);
    }
  }

  run(command: PaletteCommand): void {
    this.palette.close();
    command.run();
  }

  /** First command of each group gets a heading in the list. */
  showGroup(index: number): boolean {
    const list = this.filtered();
    return index === 0 || list[index].group !== list[index - 1].group;
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() => document.getElementById(`pal-${this.active()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  /** Saves the PDF under its friendly name (same as the page's Download buttons). */
  private downloadResume(): void {
    const link = document.createElement('a');
    link.href = this.data.profile.resumePath;
    link.download = this.data.profile.resumeFileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private copyEmail(): void {
    const email = this.data.profile.email;
    navigator.clipboard?.writeText(email).then(
      () => this.toast.show('Email copied'),
      () => (window.location.href = `mailto:${email}`)
    );
  }
}
