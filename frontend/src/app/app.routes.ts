import { Routes } from '@angular/router';

import { rolGuard } from './core/auth/guards';

import { LayoutPanel } from './layouts/layout-panel';
import { LayoutSitio } from './layouts/layout-sitio';

// Solo se registran rutas terminadas del Sprint 3.
const rutasAprendizaje: Routes = [
  {
    path: 'mi-aprendizaje',
    canActivate: [rolGuard('ESTUDIANTE')],
    title: 'Mi aprendizaje · Learnity',
    loadComponent: () =>
      import('./pages/estudiante/mi-aprendizaje/mi-aprendizaje').then(
        (m) => m.MiAprendizaje,
      ),
  },
  {
    path: 'aprender/:cursoId/:leccionId',
    canActivate: [rolGuard('ESTUDIANTE')],
    title: 'Lección · Learnity',
    loadComponent: () =>
      import('./pages/estudiante/leccion/leccion').then(
        (m) => m.Leccion,
      ),
  },
];

const rutasSeguimientoDocente: Routes = [
  {
    path: 'estudiantes',
    title: 'Estudiantes del curso · Learnity',
    data: { seccion: 'Estudiantes' },
    loadComponent: () =>
      import('./pages/docente/estudiantes/estudiantes').then(
        (m) => m.EstudiantesCurso,
      ),
  },
];

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
    canActivateChild: [rolGuard('DOCENTE')],
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
          import('./features/docente-cursos/docente-cursos.routes').then(
            (m) => m.rutasDocenteCursos,
          ),
      },
      ...rutasSeguimientoDocente,
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
    canActivateChild: [rolGuard('ADMIN')],
    data: { rol: 'ADMIN' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'revision',
      },
      {
        path: 'solicitudes',
        loadChildren: () => import('./features/usuarios/usuarios.routes').then((m) => m.rutasSolicitudes),
      },
      {
        path: 'revision',
        loadChildren: () =>
          import('./features/revision/revision.routes').then((m) => m.rutasRevision),
      },
      {
        path: 'categorias',
        loadChildren: () =>
          import('./features/admin-categorias/admin-categorias.routes').then((m) => m.rutasAdminCategorias),
      },
      {
        path: 'perfil',
        loadChildren: () =>
          import('./features/identidad/identidad.routes').then((m) => m.rutasAjustesPerfil),
      },
    ],
  },

  // Dirección desconocida: volver al inicio.
  {
    path: '**',
    redirectTo: '',
  },
];
