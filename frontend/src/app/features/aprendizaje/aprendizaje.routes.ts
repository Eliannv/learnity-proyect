import { Routes } from '@angular/router';

import { conSesionMatch, rolGuard } from '../../core/auth/guards';

/**
 * Portada personalizada del estudiante con sesión iniciada. Va antes de la portada pública,
 * dentro del layout del sitio: si no hay sesión, `conSesionMatch` deja pasar a la del catálogo.
 */
export const rutasInicioEstudiante: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [conSesionMatch],
    title: 'Inicio · Learnity',
    loadComponent: () =>
      import('./paginas/inicio-estudiante/inicio-estudiante').then((m) => m.InicioEstudiante),
  },
];

/** Mi aprendizaje y el seguimiento de cada curso inscrito. Se montan en la raíz del layout del sitio. */
export const rutasAprendizaje: Routes = [
  {
    path: 'mi-aprendizaje',
    canActivate: [rolGuard('ESTUDIANTE')],
    title: 'Mi aprendizaje · Learnity',
    loadComponent: () =>
      import('./paginas/mi-aprendizaje/mi-aprendizaje').then((m) => m.MiAprendizaje),
  },
  {
    path: 'aprender/:cursoId/:leccionId',
    canActivate: [rolGuard('ESTUDIANTE')],
    title: 'Lección · Learnity',
    loadComponent: () =>
      import('./paginas/seguimiento-curso/seguimiento-curso').then((m) => m.SeguimientoCurso),
  },
];
