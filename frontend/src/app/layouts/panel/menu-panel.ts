import { ItemTab } from '../comun/tab-bar';

/** Menú lateral y barra inferior de cada panel, según el rol. */
export interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  /** Grupo del menú lateral (uno de `grupos`). El orden de `items` no cambia: lo usa la pestaña «Más». */
  grupo: string;
  exacto?: boolean;
  contador?: string;
  destacado?: boolean;
}

/** Grupo que el menú lateral fija al pie (la cuenta), separado de las secciones de trabajo. */
export const GRUPO_CUENTA = 'Cuenta';

export const MENU: Record<
  'DOCENTE' | 'ADMIN',
  {
    etiqueta: string;
    inicio: string;
    /** Orden de los grupos del menú lateral; `GRUPO_CUENTA` va siempre al pie. */
    grupos: string[];
    items: ItemMenu[];
    tabs: ItemTab[];
  }
> = {
  DOCENTE: {
    etiqueta: 'Docente',
    inicio: '/docente',
    grupos: ['Enseñanza', GRUPO_CUENTA],

    items: [
      { icono: 'user', etiqueta: 'Mi perfil', ruta: '/docente/perfil', grupo: GRUPO_CUENTA },
      { icono: 'book-open', etiqueta: 'Mis cursos', ruta: '/docente/cursos', grupo: 'Enseñanza' },
      { icono: 'graduation-cap', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes', grupo: 'Enseñanza' },
      { icono: 'message-square-text', etiqueta: 'Reseñas', ruta: '/docente/resenas', grupo: 'Enseñanza' },
      { icono: 'chart-line', etiqueta: 'Analíticas', ruta: '/docente/analiticas', grupo: 'Enseñanza' },
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
    grupos: ['Principal', 'Comunidad', 'Contenido', 'Seguridad', GRUPO_CUENTA],

    items: [
      { icono: 'layout-dashboard', etiqueta: 'Resumen', ruta: '/admin/resumen', grupo: 'Principal' },
      { icono: 'user', etiqueta: 'Mi perfil', ruta: '/admin/perfil', grupo: GRUPO_CUENTA },
      { icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios', grupo: 'Comunidad' },
      { icono: 'user-check', etiqueta: 'Solicitudes de docente', ruta: '/admin/solicitudes', grupo: 'Comunidad' },
      { icono: 'shield-check', etiqueta: 'Revisión de cursos', ruta: '/admin/revision', grupo: 'Contenido' },
      { icono: 'tags', etiqueta: 'Categorías', ruta: '/admin/categorias', grupo: 'Contenido' },
      { icono: 'message-square-text', etiqueta: 'Reseñas', ruta: '/admin/resenas', grupo: 'Contenido' },
      { icono: 'key-round', etiqueta: 'Accesos', ruta: '/admin/accesos', grupo: 'Seguridad' },
      { icono: 'history', etiqueta: 'Auditoría', ruta: '/admin/auditoria', grupo: 'Seguridad' },
      { icono: 'shield-alert', etiqueta: 'Alertas de seguridad', ruta: '/admin/alertas', grupo: 'Seguridad' },
      { icono: 'database', etiqueta: 'Sesiones y base de datos', ruta: '/admin/sesiones', grupo: 'Seguridad' },
    ],

    // Cinco pestañas en móvil: las cuatro más usadas y «Más», que abre el resto de secciones del menú lateral
    // (Solicitudes, Categorías, Reseñas, Accesos, Auditoría, Sesiones y el perfil). La lista de «Más» se calcula
    // en el layout: todo lo de `items` que no está aquí.
    tabs: [
      { icono: 'layout-dashboard', etiqueta: 'Resumen', ruta: '/admin/resumen' },
      { icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' },
      { icono: 'shield-check', etiqueta: 'Cursos', ruta: '/admin/revision' },
      { icono: 'shield-alert', etiqueta: 'Alertas', ruta: '/admin/alertas' },
    ],
  },
};
