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
    loadComponent: () =>
      import('./features/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
    title: 'Project — Suraj Jha'
  },
  { path: '**', redirectTo: '' }
];
