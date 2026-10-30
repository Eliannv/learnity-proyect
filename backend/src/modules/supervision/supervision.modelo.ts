import type { MotivoAcceso, PasoAcceso } from '../identidad/index.js';
import type { Rol } from '../../shared/auth/tipos.js';

/** Respuestas del módulo Supervisión, tal como las recibe el cliente. */

export interface Paginacion {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface AccesoAdmin {
  id: number;
  fecha: string;
  usuario: { id: number; nombre: string } | null;
  /** El correo escrito al entrar o, si no se guardó (REFRESH), el de la cuenta. */
  correo: string | null;
  paso: PasoAcceso;
  exito: boolean;
  motivo: MotivoAcceso;
  agente: string | null;
}

export interface PaginaAccesos {
  items: AccesoAdmin[];
  paginacion: Paginacion;
}

export interface CuentaBloqueadaAdmin {
  idUsuario: number;
  nombre: string;
  correo: string;
  intentosFallidos: number;
  bloqueadoHasta: string;
}

// ------------------------------------------------------------------ auditoría (037)

export type OperacionAuditoria = 'INSERT' | 'UPDATE' | 'DELETE';

/** Una fila de auditoria_cambio en el listado del visor. */
export interface CambioAuditoria {
  id: number;
  fecha: string;
  tabla: string;
  operacion: OperacionAuditoria;
  /** Clave primaria del registro (p. ej. «12» o «12,3» en usuario_rol); null si la tabla no se conoce. */
  registro: string | null;
  /** Persona de la aplicación que hizo el cambio; null sin actor (migraciones, semillas o scripts). */
  actor: { id: number; nombre: string; correo: string | null } | null;
  /** Rol de PostgreSQL que ejecutó el cambio (session_user). */
  usuarioBd: string;
  /** Solo en UPDATE. */
  columnasCambiadas: string[] | null;
}

/** El registro completo para el diff: antes y después (sin contrasena_hash, token_hash ni archivo.ruta). */
export interface DetalleCambioAuditoria extends CambioAuditoria {
  idTransaccion: number;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export interface PaginaAuditoria {
  items: CambioAuditoria[];
  paginacion: Paginacion;
}

export interface OpcionesAuditoria {
  tablas: string[];
  usuariosBd: string[];
  /** Los 500 actores con un cambio más reciente. */
  actores: { id: number; nombre: string }[];
}

export interface EstadoBaseDatos {
  version: string;
  tamanoBytes: number;
  /** Conexiones abiertas a esta base (de cualquier rol). */
  conexiones: number;
  /** Arranque del servidor de PostgreSQL. */
  iniciadaEn: string;
  ultimaMigracion: { version: string; aplicadaEn: string | null } | null;
}

// ------------------------------------------------------------------ sesiones

export interface SesionAdmin {
  /** La familia de la sesión (UUID). */
  id: string;
  usuario: { id: number; nombre: string; correo: string; roles: Rol[] };
  agente: string | null;
  iniciadaEn: string;
  renovadaEn: string;
  expiraEn: string;
  /** Es la sesión con la que el administrador hace esta petición. */
  actual: boolean;
}

export interface PaginaSesiones {
  items: SesionAdmin[];
  paginacion: Paginacion;
}
