import { Routes } from '@angular/router';

/** Alertas de seguridad. Se monta bajo `admin/alertas`. */
export const rutasAdminAlertas: Routes = [
  {
    path: '',
    title: 'Alertas de seguridad · Learnity',
    data: { seccion: 'Alertas de seguridad' },
    loadComponent: () => import('./paginas/alertas/alertas').then((m) => m.AdminAlertas),
  },
];
