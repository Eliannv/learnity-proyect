import { Routes } from '@angular/router';

/** Inicio público (/). Se monta con pathMatch 'full'. */
export const rutasInicio: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Learnity · Cursos en línea',
    loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
  },
];

/** Catálogo y detalle del curso (cursos y cursos/:id). Se monta bajo `cursos`. */
export const rutasCatalogo: Routes = [
  {
    path: '',
    title: 'Catálogo de cursos · Learnity',
    loadComponent: () => import('./paginas/catalogo/catalogo').then((m) => m.Catalogo),
  },
  {
    path: ':id',
    title: 'Detalle del curso · Learnity',
    loadComponent: () =>
      import('./paginas/detalle-curso/detalle-curso').then((m) => m.DetalleCurso),
  },
];
