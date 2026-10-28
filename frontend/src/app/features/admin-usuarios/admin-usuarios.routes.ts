import { Routes } from '@angular/router';

/** Gestión de cuentas del administrador. Se monta bajo `admin/usuarios`. */
export const rutasAdminUsuarios: Routes = [
  {
    path: '',
    title: 'Usuarios · Learnity',
    data: { seccion: 'Usuarios' },
    loadComponent: () => import('./paginas/usuarios/usuarios').then((m) => m.AdminUsuarios),
  },
];
