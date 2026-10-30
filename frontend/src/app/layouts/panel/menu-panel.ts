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
      { icono: 'layout-dashboard', etiqueta: 'Resumen', ruta: '/admin/resumen' },
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
      { icono: 'shield-alert', etiqueta: 'Alertas de seguridad', ruta: '/admin/alertas' },
      { icono: 'database', etiqueta: 'Sesiones y base de datos', ruta: '/admin/sesiones' },
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
