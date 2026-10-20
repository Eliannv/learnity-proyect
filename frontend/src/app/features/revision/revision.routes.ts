import { Routes } from '@angular/router';

export const rutasRevision: Routes = [
  {
    path: '',
    title: 'Cursos pendientes · Learnity',
    data: { seccion: 'Revisión de cursos' },
    loadComponent: () =>
      import('./paginas/revision-cursos/revision-cursos').then((m) => m.RevisionCursos),
  },
  {
    path: ':id',
    title: 'Revisión de curso · Learnity',
    data: { seccion: 'Revisión de cursos' },
    loadComponent: () =>
      import('./paginas/revision-curso/revision-curso').then((m) => m.RevisionCurso),
  },
];

export const revisionRoutes = rutasRevision;
