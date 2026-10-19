import { Routes } from '@angular/router';

import { autenticadoGuard, conSesionMatch, rolGuard } from './core/auth/guards';

import { LayoutPanel } from './layouts/layout-panel';
import { LayoutSitio } from './layouts/layout-sitio';
import { environment } from '../environments/environment';

// Las pantallas de aprendizaje, evaluaciones y gestión futura siguen disponibles
// para demostraciones, pero no forman parte del recorrido real del Sprint 2.
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
    canActivate: [autenticadoGuard],
    title: 'Mi aprendizaje · Learnity',
    loadComponent: () =>
      import('./pages/estudiante/mi-aprendizaje/mi-aprendizaje').then(
        (m) => m.MiAprendizaje,
      ),
  },
  {
    path: 'aprender/:cursoId/evaluacion/:evaluacionId',
    canActivate: [autenticadoGuard],
    title: 'Evaluación · Learnity',
    loadComponent: () =>
      import('./pages/estudiante/evaluacion/evaluacion').then(
        (m) => m.Evaluacion,
      ),
  },
  {
    path: 'aprender/:cursoId/:leccionId',
    canActivate: [autenticadoGuard],
    title: 'Lección · Learnity',
    loadComponent: () =>
      import('./pages/estudiante/leccion/leccion').then(
        (m) => m.Leccion,
      ),
  },
];

const rutasDocenteFuturas: Routes = [
  {
    path: 'cursos/:id/evaluacion',
    title: 'Editor de evaluación · Learnity',
    data: { seccion: 'Editor de evaluación' },
    loadComponent: () =>
      import('./pages/docente/editor-evaluacion/editor-evaluacion').then(
        (m) => m.EditorEvaluacion,
      ),
  },
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
      ...(environment.sprint34Habilitado ? inicioEstudiante : []),
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('./features/catalogo/catalogo.routes').then((m) => m.rutasInicio),
      },
      {
        path: 'cursos',
        loadChildren: () => import('./features/catalogo/catalogo.routes').then((m) => m.rutasCatalogo),
      },
      ...(environment.sprint34Habilitado ? rutasAprendizaje : []),
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
        title: 'Mis cursos · Learnity',
        data: { seccion: 'Mis cursos' },
        loadComponent: () =>
          import(
            './pages/docente/mis-cursos/mis-cursos'
          ).then((m) => m.MisCursosDocente),
      },
      {
        path: 'cursos/:id/editar',
        title: 'Editar curso · Learnity',
        data: { seccion: 'Constructor de curso' },
        loadComponent: () =>
          import(
            './pages/docente/editor-curso/editor-curso'
          ).then((m) => m.EditorCurso),
      },
      ...(environment.sprint34Habilitado ? rutasDocenteFuturas : []),
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
        title: 'Cursos pendientes · Learnity',
        data: { seccion: 'Revisión de cursos' },
        loadComponent: () =>
          import(
            './pages/admin/revision-cursos/revision-cursos'
          ).then((m) => m.RevisionCursos),
      },
      {
        path: 'revision/:id',
        title: 'Revisión de curso · Learnity',
        data: { seccion: 'Revisión de cursos' },
        loadComponent: () =>
          import(
            './pages/admin/revision-curso/revision-curso'
          ).then((m) => m.RevisionCurso),
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
