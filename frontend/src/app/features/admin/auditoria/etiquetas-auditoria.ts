/**
 * Nombres de negocio para el visor de auditoría: la API sigue recibiendo y devolviendo los valores internos (tabla,
 * operación y rol de PostgreSQL), pero la interfaz nunca muestra el esquema de la base.
 */
const TABLAS: Readonly<Record<string, string>> = {
  alerta_seguridad: 'Alertas de seguridad',
  archivo: 'Archivos subidos',
  categoria: 'Categorías',
  curso: 'Cursos',
  docente: 'Perfiles de docente',
  leccion: 'Lecciones',
  modulo: 'Módulos de curso',
  persona: 'Datos personales',
  recurso_adjunto: 'Recursos de lecciones',
  reporte_resena: 'Reportes de reseñas',
  resena: 'Reseñas',
  solicitud_docente: 'Solicitudes de docente',
  usuario: 'Cuentas de usuario',
  usuario_rol: 'Roles asignados',
};

const OPERACIONES: Readonly<Record<string, string>> = {
  INSERT: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
};

/** Una tabla nueva sin traducir se muestra con sus palabras («recurso adjunto»), nunca con guiones bajos. */
export const nombreTabla = (tabla: string): string => TABLAS[tabla] ?? tabla.replace(/_/g, ' ');

export const nombreOperacion = (operacion: string): string => OPERACIONES[operacion] ?? operacion;

/** learnity_app es la aplicación; cualquier otro rol (postgres, learnity_owner, migraciones) es mantenimiento. */
export const nombreRolBd = (rol: string): string => (rol === 'learnity_app' ? 'Aplicación web' : 'Sistema / Mantenimiento');
