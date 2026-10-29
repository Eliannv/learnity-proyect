import { Routes } from '@angular/router';

/** Gestión de categorías del administrador. Se monta bajo `admin/categorias`. */
export const rutasAdminCategorias: Routes = [
  {
    path: '',
    title: 'Categorías · Learnity',
    data: { seccion: 'Categorías' },
    loadComponent: () =>
      import('./paginas/categorias/categorias').then((m) => m.Categorias),
  },
];
