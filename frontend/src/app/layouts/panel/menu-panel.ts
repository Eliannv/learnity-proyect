import { ItemTab } from '../comun/tab-bar';

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
      { icono: 'message-square-text', etiqueta: 'Reseñas', ruta: '/docente/resenas' },
      { icono: 'chart-line', etiqueta: 'Analíticas', ruta: '/docente/analiticas' },
    ],

    tabs: [
      {
        icono: 'book-open',
        etiqueta: 'Mis cursos',
        ruta: '/docente/cursos',
      },
      { icono: 'graduation-cap', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes' },
      { icono: 'message-square-text', etiqueta: 'Reseñas', ruta: '/docente/resenas' },
      { icono: 'chart-line', etiqueta: 'Analíticas', ruta: '/docente/analiticas' },
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
      { icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' },
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
      { icono: 'message-square-text', etiqueta: 'Reseñas', ruta: '/admin/resenas' },
      { icono: 'key-round', etiqueta: 'Accesos', ruta: '/admin/accesos' },
      { icono: 'history', etiqueta: 'Auditoría', ruta: '/admin/auditoria' },
      { icono: 'database', etiqueta: 'Sesiones y base de datos', ruta: '/admin/sesiones' },
    ],

    // Máximo cinco pestañas en móvil: el perfil sigue en el menú de la cuenta (avatar).
    tabs: [
      { icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' },
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
      { icono: 'message-square-text', etiqueta: 'Reseñas', ruta: '/admin/resenas' },
    ],
  },
};
