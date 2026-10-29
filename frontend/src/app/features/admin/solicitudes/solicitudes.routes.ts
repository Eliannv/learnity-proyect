import { Routes } from '@angular/router';

/** Solicitudes de docente. Se monta bajo `admin/solicitudes`. */
export const rutasSolicitudes: Routes = [
  {
    path: '',
    title: 'Solicitudes de docente · Learnity',
    data: { seccion: 'Solicitudes de docente' },
    loadComponent: () =>
      import('./paginas/solicitudes/solicitudes').then((m) => m.Solicitudes),
  },
];
