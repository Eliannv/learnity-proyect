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

// ------------------------------------------------------------------ resumen

export interface ResumenAdmin {
  /** Lo que espera una acción del administrador; cada contador enlaza a su vista. */
  atencion: {
    solicitudesDocente: number;
    cursosEnRevision: number;
    reportesResenas: number;
    alertasSeguridad: number;
    /** De las alertas pendientes, las de severidad ALTA. */
    alertasAltas: number;
    cuentasBloqueadas: number;
  };
  usuarios: { activos: number; inactivos: number; porRol: { ESTUDIANTE: number; DOCENTE: number; ADMIN: number } };
  cursos: {
    total: number;
    porEstado: { BORRADOR: number; EN_REVISION: number; PUBLICADO: number; RECHAZADO: number; ARCHIVADO: number; SUSPENDIDO: number };
  };
  inscripciones: { total: number; activas: number; completadas: number };
  /** Reseñas visibles (ni borradas ni ocultadas) de cursos publicados. */
  resenas: { promedio: number | null; total: number };
  generadoEn: string;
}

// ------------------------------------------------------------------ alertas (038)

export type TipoAlerta = 'INTENTOS_FALLIDOS' | 'CAMBIO_PRIVILEGIOS' | 'RAFAGA_RESENAS' | 'MODIFICACION_MASIVA';
export type SeveridadAlerta = 'ALTA' | 'MEDIA' | 'BAJA';

export interface AlertaSeguridad {
  id: number;
  tipo: TipoAlerta;
  severidad: SeveridadAlerta;
  descripcion: string;
  detectadaEn: string;
  /** Cuenta implicada (la atacada, la que recibió o perdió el rol, o la del actor); null si no hay o se borró. */
  usuario: { id: number; nombre: string; correo: string } | null;
  /** Registros que la provocaron: ids del visor de auditoría y del registro de accesos. */
  evidencia: { auditoria: number[]; accesos: number[] };
  atencion: { fecha: string; por: { id: number; nombre: string } | null; nota: string | null } | null;
}

export interface PaginaAlertas {
  items: AlertaSeguridad[];
  paginacion: Paginacion;
  contadores: { pendientes: number; todas: number };
}

export interface ResultadoAnalisis {
  /** Alertas nuevas (las repetidas no se duplican). */
  nuevas: number;
  /** Desde cuándo se revisó (las últimas 24 horas). */
  desde: string;
}
