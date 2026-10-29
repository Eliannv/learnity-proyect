import { Routes } from '@angular/router';

/** Seguimiento de los estudiantes de cada curso del docente. Se monta bajo `docente/estudiantes`. */
export const rutasDocenteEstudiantes: Routes = [
  {
    path: '',
    title: 'Estudiantes del curso · Learnity',
    data: { seccion: 'Estudiantes' },
    loadComponent: () =>
      import('./paginas/estudiantes/estudiantes').then((m) => m.EstudiantesCurso),
  },
];
