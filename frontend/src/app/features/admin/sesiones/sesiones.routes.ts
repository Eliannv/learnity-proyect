import { Routes } from '@angular/router';

/** Sesiones abiertas y estado de la base de datos. Se monta bajo `admin/sesiones`. */
export const rutasAdminSesiones: Routes = [
  {
    path: '',
    title: 'Sesiones y base de datos · Learnity',
    data: { seccion: 'Sesiones y base de datos' },
    loadComponent: () => import('./paginas/sesiones/sesiones').then((m) => m.AdminSesiones),
  },
];
