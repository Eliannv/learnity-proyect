import { Routes } from '@angular/router';

/** Bandeja de reseñas del docente. Se monta bajo `docente/resenas`. */
export const rutasDocenteResenas: Routes = [
  {
    path: '',
    title: 'Reseñas · Learnity',
    data: { seccion: 'Reseñas' },
    loadComponent: () => import('./paginas/resenas/resenas').then((m) => m.ResenasDocente),
  },
];
