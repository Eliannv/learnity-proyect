import { Routes } from '@angular/router';

import { autenticadoGuard, invitadoGuard, perfilEstudianteGuard } from '../../core/auth/guards';

/** Cada export se monta en app.routes.ts bajo su URL; las rutas hijas usan path vacío. */

export const rutasLogin: Routes = [
  {
    path: '',
    canActivate: [invitadoGuard],
    title: 'Iniciar sesión · Learnity',
    loadComponent: () => import('./paginas/login/login').then((m) => m.Login),
  },
];

export const rutasRegistro: Routes = [
  {
    path: '',
    canActivate: [invitadoGuard],
    title: 'Crear cuenta · Learnity',
    loadComponent: () => import('./paginas/registro/registro').then((m) => m.Registro),
  },
];

export const rutasRecuperar: Routes = [
  {
    path: '',
    canActivate: [invitadoGuard],
    title: 'Recuperar contraseña · Learnity',
    loadComponent: () => import('./paginas/recuperar/recuperar').then((m) => m.Recuperar),
  },
];

export const rutasRestablecer: Routes = [
  {
    path: '',
    title: 'Crear nueva contraseña · Learnity',
    loadComponent: () =>
      import('./paginas/restablecer/restablecer').then((m) => m.Restablecer),
  },
];

/** Perfil del Estudiante (/perfil). */
export const rutasPerfilEstudiante: Routes = [
  {
    path: '',
    canActivate: [autenticadoGuard, perfilEstudianteGuard],
    title: 'Mi perfil · Learnity',
    loadComponent: () =>
      import('./paginas/perfil-estudiante/perfil-estudiante').then((m) => m.PerfilEstudiante),
  },
];

/** Ajustes y perfil de Docente y Administrador, dentro de su panel (docente/perfil y admin/perfil). */
export const rutasAjustesPerfil: Routes = [
  {
    path: '',
    title: 'Ajustes y perfil · Learnity',
    data: { seccion: 'Ajustes y perfil' },
    loadComponent: () =>
      import('./paginas/ajustes-perfil/ajustes-perfil').then((m) => m.AjustesPerfil),
  },
];
