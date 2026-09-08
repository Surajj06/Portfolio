import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
    title: 'Suraj Jha — AI Engineer'
  },
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./features/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
    title: 'Project — Suraj Jha'
  },
  { path: '**', redirectTo: '' }
];
