import { Routes } from '@angular/router';
import { autenticadoGuard, conSesionMatch, invitadoGuard, perfilEstudianteGuard, rolGuard } from './core/auth/guards';
import { LayoutPanel } from './layouts/layout-panel';
import { LayoutSitio } from './layouts/layout-sitio';

export const routes: Routes = [
  // ── Acceso (sin header ni footer)
  {
    path: 'login',
    canActivate: [invitadoGuard],
    title: 'Iniciar sesión · Learnity',
    loadComponent: () => import('./pages/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    canActivate: [invitadoGuard],
    title: 'Crear cuenta · Learnity',
    loadComponent: () => import('./pages/auth/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'recuperar-contrasena',
    canActivate: [invitadoGuard],
    title: 'Recuperar contraseña · Learnity',
    loadComponent: () => import('./pages/auth/recuperar/recuperar').then((m) => m.Recuperar),
  },

  // ── Sitio: Visitante y vista Estudiante
  {
    path: '',
    component: LayoutSitio,
    children: [
      // Con sesión, el inicio es el personalizado (todos los roles); sin sesión, la portada pública.
      {
        path: '',
        pathMatch: 'full',
        canMatch: [conSesionMatch],
        title: 'Inicio · Learnity',
        loadComponent: () => import('./pages/estudiante/inicio-estudiante/inicio-estudiante').then((m) => m.InicioEstudiante),
      },
      {
        path: '',
        pathMatch: 'full',
        title: 'Learnity · Cursos en línea',
        loadComponent: () => import('./pages/publico/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'cursos',
        title: 'Catálogo de cursos · Learnity',
        loadComponent: () => import('./pages/publico/catalogo/catalogo').then((m) => m.Catalogo),
      },
      {
        path: 'cursos/:id',
        title: 'Detalle del curso · Learnity',
        loadComponent: () => import('./pages/publico/detalle-curso/detalle-curso').then((m) => m.DetalleCurso),
      },
      {
        path: 'mi-aprendizaje',
        canActivate: [autenticadoGuard],
        title: 'Mi aprendizaje · Learnity',
        loadComponent: () => import('./pages/estudiante/mi-aprendizaje/mi-aprendizaje').then((m) => m.MiAprendizaje),
      },
      {
        path: 'aprender/:cursoId/evaluacion/:evaluacionId',
        canActivate: [autenticadoGuard],
        title: 'Evaluación · Learnity',
        loadComponent: () => import('./pages/estudiante/evaluacion/evaluacion').then((m) => m.Evaluacion),
      },
      {
        path: 'aprender/:cursoId/:leccionId',
        canActivate: [autenticadoGuard],
        title: 'Lección · Learnity',
        loadComponent: () => import('./pages/estudiante/leccion/leccion').then((m) => m.Leccion),
      },
      {
        path: 'perfil',
        canActivate: [autenticadoGuard, perfilEstudianteGuard],
        title: 'Mi perfil · Learnity',
        loadComponent: () => import('./pages/estudiante/perfil/perfil').then((m) => m.PerfilEstudiante),
      },
    ],
  },

  // ── Docente
  {
    path: 'docente',
    component: LayoutPanel,
    canActivate: [rolGuard('DOCENTE')],
    data: { rol: 'DOCENTE' },
    children: [
      {
        path: '',
        title: 'Panel del docente · Learnity',
        data: { seccion: 'Panel' },
        loadComponent: () => import('./pages/docente/panel/panel').then((m) => m.PanelDocente),
      },
      {
        path: 'cursos',
        title: 'Mis cursos · Learnity',
        data: { seccion: 'Mis cursos' },
        loadComponent: () => import('./pages/docente/mis-cursos/mis-cursos').then((m) => m.MisCursosDocente),
      },
      {
        path: 'cursos/:id/editar',
        title: 'Editar curso · Learnity',
        data: { seccion: 'Constructor de curso' },
        loadComponent: () => import('./pages/docente/editor-curso/editor-curso').then((m) => m.EditorCurso),
      },
      {
        path: 'cursos/:id/evaluacion',
        title: 'Editor de evaluación · Learnity',
        data: { seccion: 'Editor de evaluación' },
        loadComponent: () => import('./pages/docente/editor-evaluacion/editor-evaluacion').then((m) => m.EditorEvaluacion),
      },
      {
        path: 'estudiantes',
        title: 'Estudiantes del curso · Learnity',
        data: { seccion: 'Estudiantes' },
        loadComponent: () => import('./pages/docente/estudiantes/estudiantes').then((m) => m.EstudiantesCurso),
      },
      {
        path: 'perfil',
        title: 'Ajustes y perfil · Learnity',
        data: { seccion: 'Ajustes y perfil' },
        loadComponent: () => import('./pages/cuenta/ajustes-perfil/ajustes-perfil').then((m) => m.AjustesPerfil),
      },
    ],
  },

  // ── Administrador
  {
    path: 'admin',
    component: LayoutPanel,
    canActivate: [rolGuard('ADMIN')],
    data: { rol: 'ADMIN' },
    children: [
      {
        path: '',
        title: 'Panel de administración · Learnity',
        data: { seccion: 'Administración' },
        loadComponent: () => import('./pages/admin/panel/panel').then((m) => m.PanelAdmin),
      },
      {
        path: 'usuarios',
        title: 'Usuarios · Learnity',
        data: { seccion: 'Administración' },
        loadComponent: () => import('./pages/admin/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'solicitudes',
        title: 'Solicitudes de docente · Learnity',
        data: { seccion: 'Administración' },
        loadComponent: () => import('./pages/admin/solicitudes/solicitudes').then((m) => m.Solicitudes),
      },
      { path: 'revision', pathMatch: 'full', redirectTo: 'revision/diseno-ux-desde-cero' },
      {
        path: 'revision/:id',
        title: 'Revisión de curso · Learnity',
        data: { seccion: 'Administración' },
        loadComponent: () => import('./pages/admin/revision-curso/revision-curso').then((m) => m.RevisionCurso),
      },
      {
        path: 'categorias',
        title: 'Categorías · Learnity',
        data: { seccion: 'Administración' },
        loadComponent: () => import('./pages/admin/categorias/categorias').then((m) => m.Categorias),
      },
      {
        path: 'perfil',
        title: 'Ajustes y perfil · Learnity',
        data: { seccion: 'Ajustes y perfil' },
        loadComponent: () => import('./pages/cuenta/ajustes-perfil/ajustes-perfil').then((m) => m.AjustesPerfil),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
