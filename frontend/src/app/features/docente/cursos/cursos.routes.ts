import { Routes } from '@angular/router';

export const rutasDocenteCursos: Routes = [
  {
    path: '',
    title: 'Mis cursos · Learnity',
    data: { seccion: 'Mis cursos' },
    loadComponent: () =>
      import('./paginas/mis-cursos/mis-cursos').then((m) => m.MisCursosDocente),
  },
  {
    path: ':id/editar',
    title: 'Editar curso · Learnity',
    data: { seccion: 'Constructor de curso' },
    loadComponent: () =>
      import('./paginas/editor-curso/editor-curso').then((m) => m.EditorCurso),
  },
];

export const docenteCursosRoutes = rutasDocenteCursos;
