import { Routes } from '@angular/router';

/** Registro de inicios de sesión y cuentas bloqueadas. Se monta bajo `admin/accesos`. */
export const rutasAdminAccesos: Routes = [
  {
    path: '',
    title: 'Accesos · Learnity',
    data: { seccion: 'Accesos' },
    loadComponent: () => import('./paginas/accesos/accesos').then((m) => m.AdminAccesos),
  },
];
