import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Coalescing batches bursts of events/tasks into a single change-detection
    // pass. Hot paths (scroll, pointer, rAF loops) additionally run outside
    // the zone entirely — see ScrollService / SpotlightService / CursorComponent.
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      // `:id` from the URL arrives as an @Input on the project page.
      withComponentInputBinding()
      // NOTE: no withViewTransitions() here. Angular's router integration made
      // client-side navigations to project pages hang (URL changed, view never
      // rendered) — the same class of problem as the old "router view
      // transitions delayed content by 4+ seconds" commit. Page changes are
      // instant instead; the theme toggle still uses View Transitions directly.
    ),
    provideClientHydration()
  ]
};
