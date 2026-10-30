import { Routes } from '@angular/router';

/** Resumen del panel del administrador (portada de /admin). Se monta bajo `admin/resumen`. */
export const rutasAdminResumen: Routes = [
  {
    path: '',
    title: 'Resumen · Learnity',
    data: { seccion: 'Resumen' },
    loadComponent: () => import('./paginas/resumen/resumen').then((m) => m.AdminResumen),
  },
];
