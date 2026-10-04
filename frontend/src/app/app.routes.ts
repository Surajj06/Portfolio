import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Suraj Jha — AI Engineer'
  },
  {
    path: 'projects/:id',
    // No static `title` here: SeoService sets a per-project title, and a route title
    // would override it as soon as navigation ends.
    loadComponent: () =>
      import('./features/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent)
  },
  { path: '**', redirectTo: '' }
];
