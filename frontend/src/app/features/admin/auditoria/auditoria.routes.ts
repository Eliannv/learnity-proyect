import { Routes } from '@angular/router';

/** Visor de auditoría de la base. Se monta bajo `admin/auditoria`. */
export const rutasAdminAuditoria: Routes = [
  {
    path: '',
    title: 'Auditoría · Learnity',
    data: { seccion: 'Auditoría' },
    loadComponent: () => import('./paginas/auditoria/auditoria').then((m) => m.AdminAuditoria),
  },
];
