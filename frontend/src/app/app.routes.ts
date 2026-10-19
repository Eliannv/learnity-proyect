import { Routes } from '@angular/router';

import {
  autenticadoGuard,
  conSesionMatch,
  invitadoGuard,
  perfilEstudianteGuard,
  rolGuard,
} from './core/auth/guards';

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
  {
    path: 'login',
    canActivate: [invitadoGuard],
    title: 'Iniciar sesión · Learnity',
    loadComponent: () =>
      import('./pages/auth/login/login').then(
        (m) => m.Login,
      ),
  },
  {
    path: 'registro',
    canActivate: [invitadoGuard],
    title: 'Crear cuenta · Learnity',
    loadComponent: () =>
      import('./pages/auth/registro/registro').then(
        (m) => m.Registro,
      ),
  },
  {
    path: 'recuperar-contrasena',
    canActivate: [invitadoGuard],
    title: 'Recuperar contraseña · Learnity',
    loadComponent: () =>
      import('./pages/auth/recuperar/recuperar').then(
        (m) => m.Recuperar,
      ),
  },
  {
    path: 'restablecer-contrasena',
    title: 'Crear nueva contraseña · Learnity',
    loadComponent: () =>
      import('./pages/auth/restablecer/restablecer').then(
        (m) => m.Restablecer,
      ),
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
        title: 'Learnity · Cursos en línea',
        loadComponent: () =>
          import('./pages/publico/inicio/inicio').then(
            (m) => m.Inicio,
          ),
      },
      {
        path: 'cursos',
        title: 'Catálogo de cursos · Learnity',
        loadComponent: () =>
          import('./pages/publico/catalogo/catalogo').then(
            (m) => m.Catalogo,
          ),
      },
      {
        path: 'cursos/:id',
        title: 'Detalle del curso · Learnity',
        loadComponent: () =>
          import(
            './pages/publico/detalle-curso/detalle-curso'
          ).then((m) => m.DetalleCurso),
      },
      ...(environment.sprint34Habilitado ? rutasAprendizaje : []),
      {
        path: 'perfil',
        canActivate: [
          autenticadoGuard,
          perfilEstudianteGuard,
        ],
        title: 'Mi perfil · Learnity',
        loadComponent: () =>
          import('./pages/estudiante/perfil/perfil').then(
            (m) => m.PerfilEstudiante,
          ),
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
        title: 'Ajustes y perfil · Learnity',
        data: { seccion: 'Ajustes y perfil' },
        loadComponent: () =>
          import(
            './pages/cuenta/ajustes-perfil/ajustes-perfil'
          ).then((m) => m.AjustesPerfil),
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
        title: 'Solicitudes de docente · Learnity',
        data: { seccion: 'Solicitudes de docente' },
        loadComponent: () =>
          import(
            './pages/admin/solicitudes/solicitudes'
          ).then((m) => m.Solicitudes),
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
        title: 'Categorías · Learnity',
        data: { seccion: 'Categorías' },
        loadComponent: () =>
          import('./pages/admin/categorias/categorias').then(
            (m) => m.Categorias,
          ),
      },
      {
        path: 'perfil',
        title: 'Ajustes y perfil · Learnity',
        data: { seccion: 'Ajustes y perfil' },
        loadComponent: () =>
          import(
            './pages/cuenta/ajustes-perfil/ajustes-perfil'
          ).then((m) => m.AjustesPerfil),
      },
    ],
  },

  // Dirección desconocida: volver al inicio.
  {
    path: '**',
    redirectTo: '',
  },
];
