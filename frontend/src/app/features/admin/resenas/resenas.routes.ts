import { Routes } from '@angular/router';

/** Reseñas y moderación del administrador. Se monta bajo `admin/resenas`. */
export const rutasAdminResenas: Routes = [
  {
    path: '',
    title: 'Reseñas · Learnity',
    data: { seccion: 'Reseñas' },
    loadComponent: () => import('./paginas/reportes/reportes').then((m) => m.ReportesResenas),
  },
];
