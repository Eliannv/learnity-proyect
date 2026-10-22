import { ItemTab } from '../shared/layout/tab-bar';
import { environment } from '../../environments/environment';

/** Menú lateral y barra inferior de cada panel, según el rol. */
export interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  exacto?: boolean;
  contador?: string;
  destacado?: boolean;
}

export const MENU: Record<
  'DOCENTE' | 'ADMIN',
  {
    etiqueta: string;
    inicio: string;
    items: ItemMenu[];
    tabs: ItemTab[];
  }
> = {
  DOCENTE: {
    etiqueta: 'Docente',
    inicio: '/docente',

    items: [
      {
        icono: 'user',
        etiqueta: 'Mi perfil',
        ruta: '/docente/perfil',
      },
      {
        icono: 'book-open',
        etiqueta: 'Mis cursos',
        ruta: '/docente/cursos',
      },
      { icono: 'graduation-cap', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes' },
    ],

    tabs: [
      {
        icono: 'book-open',
        etiqueta: 'Mis cursos',
        ruta: '/docente/cursos',
      },
      { icono: 'chart-no-axes-column', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes' },
      {
        icono: 'user',
        etiqueta: 'Perfil',
        ruta: '/docente/perfil',
      },
    ],
  },

  ADMIN: {
    etiqueta: 'Admin',
    inicio: '/admin',

    items: [
      {
        icono: 'user',
        etiqueta: 'Mi perfil',
        ruta: '/admin/perfil',
      },
      ...(environment.sprint34Habilitado
        ? [{ icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' }]
        : []),
      {
        icono: 'user-check',
        etiqueta: 'Solicitudes de docente',
        ruta: '/admin/solicitudes',
      },
      {
        icono: 'shield-check',
        etiqueta: 'Revisión de cursos',
        ruta: '/admin/revision',
      },
      {
        icono: 'tags',
        etiqueta: 'Categorías',
        ruta: '/admin/categorias',
      },
    ],

    tabs: [
      ...(environment.sprint34Habilitado
        ? [{ icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' }]
        : []),
      {
        icono: 'user-check',
        etiqueta: 'Solicitudes',
        ruta: '/admin/solicitudes',
      },
      {
        icono: 'shield-check',
        etiqueta: 'Cursos',
        ruta: '/admin/revision',
      },
      {
        icono: 'tags',
        etiqueta: 'Categorías',
        ruta: '/admin/categorias',
      },
      {
        icono: 'user',
        etiqueta: 'Perfil',
        ruta: '/admin/perfil',
      },
    ],
  },
};
