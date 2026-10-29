import { Routes } from '@angular/router';

import { rolGuard } from './core/auth/guards';
import { rutasAprendizaje, rutasInicioEstudiante } from './features/aprendizaje/aprendizaje.routes';

import { LayoutPanel } from './layouts/panel/layout-panel';
import { LayoutSitio } from './layouts/sitio/layout-sitio';

export const routes: Routes = [
  // Acceso y recuperación de contraseña.
  { path: 'login', loadChildren: () => import('./features/identidad/identidad.routes').then((m) => m.rutasLogin) },
  { path: 'registro', loadChildren: () => import('./features/identidad/identidad.routes').then((m) => m.rutasRegistro) },
  {
    path: 'recuperar-contrasena',
    loadChildren: () => import('./features/identidad/identidad.routes').then((m) => m.rutasRecuperar),
  },
  {
    path: 'restablecer-contrasena',
    loadChildren: () => import('./features/identidad/identidad.routes').then((m) => m.rutasRestablecer),
  },

  // Sitio público y pantallas del estudiante.
  {
    path: '',
    component: LayoutSitio,
    children: [
      ...rutasInicioEstudiante,
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('./features/catalogo/catalogo.routes').then((m) => m.rutasInicio),
      },
      {
        path: 'cursos',
        loadChildren: () => import('./features/catalogo/catalogo.routes').then((m) => m.rutasCatalogo),
      },
      ...rutasAprendizaje,
      {
        path: 'perfil',
        loadChildren: () =>
          import('./features/identidad/identidad.routes').then((m) => m.rutasPerfilEstudiante),
      },
    ],
  },

  // Panel del docente.
  {
    path: 'docente',
    component: LayoutPanel,
    canActivate: [rolGuard('DOCENTE')],
    data: { rol: 'DOCENTE' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'cursos',
      },
      {
        path: 'cursos',
        loadChildren: () =>
          import('./features/docente/cursos/cursos.routes').then(
            (m) => m.rutasDocenteCursos,
          ),
      },
      {
        path: 'estudiantes',
        loadChildren: () =>
          import('./features/docente/estudiantes/estudiantes.routes').then((m) => m.rutasDocenteEstudiantes),
      },
      {
        path: 'resenas',
        loadChildren: () =>
          import('./features/docente/resenas/resenas.routes').then((m) => m.rutasDocenteResenas),
      },
      {
        path: 'analiticas',
        loadChildren: () =>
          import('./features/docente/analiticas/analiticas.routes').then((m) => m.rutasDocenteAnaliticas),
      },
      {
        path: 'perfil',
        loadChildren: () =>
          import('./features/identidad/identidad.routes').then((m) => m.rutasAjustesPerfil),
      },
    ],
  },

  // Panel del administrador.
  {
    path: 'admin',
    component: LayoutPanel,
    canActivate: [rolGuard('ADMIN')],
    data: { rol: 'ADMIN' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'revision',
      },
      {
        path: 'usuarios',
        loadChildren: () =>
          import('./features/admin/usuarios/usuarios.routes').then((m) => m.rutasAdminUsuarios),
      },
      {
        path: 'solicitudes',
        loadChildren: () => import('./features/admin/solicitudes/solicitudes.routes').then((m) => m.rutasSolicitudes),
      },
      {
        path: 'revision',
        loadChildren: () =>
          import('./features/admin/revision/revision.routes').then((m) => m.rutasRevision),
      },
      {
        path: 'categorias',
        loadChildren: () =>
          import('./features/admin/categorias/categorias.routes').then((m) => m.rutasAdminCategorias),
      },
      {
        path: 'resenas',
        loadChildren: () =>
          import('./features/admin/resenas/resenas.routes').then((m) => m.rutasAdminResenas),
      },
      {
        path: 'perfil',
        loadChildren: () =>
          import('./features/identidad/identidad.routes').then((m) => m.rutasAjustesPerfil),
      },
    ],
  },

  // Sin el rol necesario (lo decide rolGuard): explica por qué en vez de redirigir sin aviso.
  {
    path: 'acceso-denegado',
    component: LayoutSitio,
    children: [{
      path: '',
      title: 'Acceso denegado · Learnity',
      data: { tipo: '403' },
      loadComponent: () => import('./features/errores/pagina-error').then((m) => m.PaginaError),
    }],
  },

  // Dirección desconocida: página 404 con caminos de vuelta.
  {
    path: '**',
    component: LayoutSitio,
    children: [{
      path: '',
      title: 'Página no encontrada · Learnity',
      data: { tipo: '404' },
      loadComponent: () => import('./features/errores/pagina-error').then((m) => m.PaginaError),
    }],
  },
];
