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
