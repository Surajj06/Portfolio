import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withViewTransitions({
        // The browser aborts a view transition if another one starts (or the
        // page navigates) before it settles — harmless, but left uncaught it
        // logs as an "Uncaught (in promise) InvalidStateError". Silence just
        // that bookkeeping rejection; it has no effect on the transition itself.
        onViewTransitionCreated: ({ transition }) => {
          transition.ready.catch(() => {});
          transition.finished.catch(() => {});
          transition.updateCallbackDone.catch(() => {});
        }
      })
    ),
    provideHttpClient(),
    provideAnimations()
  ]
};
