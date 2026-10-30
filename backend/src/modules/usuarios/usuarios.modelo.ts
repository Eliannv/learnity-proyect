import type { ESTADOS_SOLICITUD } from './usuarios.esquemas.js';

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export interface SolicitudDocente {
  id: number;
  estado: EstadoSolicitud;
  especialidad: string;
  motivo: string;
  observacion: string | null;
  enviadaEn: string;
  revisadaEn: string | null;
  /** Solo REVOCADA: cuándo y por qué se retiró el rol docente. */
  revocacion: { revocadaEn: string; motivo: string } | null;
  /** Cursos publicados del perfil docente de la persona (para avisar antes de revocar, D3). */
  cursosPublicados: number;
  solicitante: {
    nombres: string;
    apellidos: string;
    correo: string;
    estudianteDesde: string;
    cursosCompletados: number;
  };
}

export type RolUsuario = 'ESTUDIANTE' | 'DOCENTE' | 'ADMIN';
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

export interface UsuarioAdmin {
  id: number;
  idPersona: number;
  nombre: string;
  nombres: string;
  apellidos: string;
  correo: string;
  ciudad: string | null;
  fotoUrl: string | null;
  roles: RolUsuario[];
  activo: boolean;
  estado: EstadoUsuario;
  creadoEn: string;
  ultimoAcceso: string | null;
  /** Fin del bloqueo temporal por intentos fallidos si sigue vigente; null si no está bloqueada. */
  bloqueadoHasta: string | null;
}

/** Ficha completa de una cuenta para el administrador. */
export interface DetalleUsuarioAdmin extends UsuarioAdmin {
  intentosFallidos: number;
  /** Especialidad del perfil docente, si lo tiene (aunque esté inactivo). */
  especialidad: string | null;
  /** Vencimiento de la invitación sin usar (cuenta creada por un administrador), o null. */
  invitacionPendienteHasta: string | null;
  sesiones: { id: string; iniciadaEn: string; renovadaEn: string; expiraEn: string; agente: string | null }[];
  inscripciones: {
    curso: { id: number; titulo: string };
    estado: 'ACTIVA' | 'COMPLETADA';
    progresoPct: number;
    inscritoEn: string;
    ultimaActividadEn: string;
  }[];
  cursosCreados: { id: number; titulo: string; estado: string; inscritos: number }[];
}

export interface RespuestaUsuariosAdmin {
  items: UsuarioAdmin[];
  paginacion: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  };
  conteos: {
    total: number;
    estudiantes: number;
    docentes: number;
    administradores: number;
  };
}
