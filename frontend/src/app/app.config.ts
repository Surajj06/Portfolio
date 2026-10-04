import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
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
      withComponentInputBinding(),
      // Smooth cross-fades between pages, and the project art morphing into
      // the case-study header (shared element). `skipInitialTransition` is
      // essential: without it the very first page load waits on a transition
      // (that was the multi-second delay the old site once had).
      withViewTransitions({ skipInitialTransition: true })
    ),
    provideClientHydration()
  ]
};
