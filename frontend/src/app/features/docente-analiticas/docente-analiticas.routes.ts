import { Routes } from '@angular/router';

/** Analíticas de rendimiento de los cursos del docente. Se monta bajo `docente/analiticas`. */
export const rutasDocenteAnaliticas: Routes = [
  {
    path: '',
    title: 'Analíticas · Learnity',
    data: { seccion: 'Analíticas' },
    loadComponent: () => import('./paginas/analiticas/analiticas').then((m) => m.AnaliticasDocente),
  },
];
