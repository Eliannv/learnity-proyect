import { Routes } from '@angular/router';

import { conSesionMatch, rolGuard } from './core/auth/guards';

import { LayoutPanel } from './layouts/layout-panel';
import { LayoutSitio } from './layouts/layout-sitio';
import { environment } from '../environments/environment';

// La portada personalizada y las evaluaciones pertenecen a un sprint posterior.
const inicioEstudiante: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [conSesionMatch],
    title: 'Inicio · Learnity',
    loadComponent: () =>
      import('./pages/estudiante/inicio-estudiante/inicio-estudiante').then(
        (m) => m.InicioEstudiante,
      ),
  },
];

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

const rutasAdminFuturas: Routes = [
  {
    path: 'usuarios',
    title: 'Usuarios · Learnity',
    data: { seccion: 'Usuarios' },
    loadComponent: () =>
      import('./pages/admin/usuarios/usuarios').then((m) => m.Usuarios),
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
      ...inicioEstudiante,
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
    data: { rol: 'ADMIN' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'revision',
      },
      ...(environment.sprint34Habilitado ? rutasAdminFuturas : []),
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
