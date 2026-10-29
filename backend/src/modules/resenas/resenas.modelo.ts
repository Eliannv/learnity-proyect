export interface RespuestaDocente {
  texto: string;
  fecha: string;
}

export interface Resena {
  id: number;
  /** Nombre y la inicial del apellido: nunca el correo ni el nombre completo. */
  autor: string;
  fotoUrl: string | null;
  estrellas: number;
  comentario: string | null;
  creadoEn: string;
  actualizadoEn: string;
  /** Cambió estrellas o comentario después de publicarla. */
  editado: boolean;
  respuesta: RespuestaDocente | null;
}

export interface ResumenResenas {
  promedio: number | null;
  total: number;
  /** Cantidad de reseñas con 1, 2, 3, 4 y 5 estrellas (índices 0 a 4). */
  distribucion: number[];
}

export interface PaginaResenas {
  resumen: ResumenResenas;
  items: Resena[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface MiResena {
  /** Inscrito en el curso publicado: puede escribir, editar o borrar su reseña. */
  puedeResenar: boolean;
  resena: Resena | null;
}

// ------------------------------------------------------------------ docente

export type MotivoReporte = 'SPAM' | 'OFENSIVO' | 'OTRO';
export type EstadoReporte = 'PENDIENTE' | 'OCULTADA' | 'DESESTIMADA';

/** Lo que el docente ve de una reseña de sus cursos: sin IPs ni detalles técnicos de auditoría. */
export interface ResenaDocente {
  id: number;
  curso: { id: number; titulo: string };
  estudiante: string;
  fotoUrl: string | null;
  estrellas: number;
  /** Estrellas con que la publicó; distinto de `estrellas` si la editó después. */
  estrellasOriginales: number;
  comentario: string | null;
  creadoEn: string;
  editado: boolean;
  editadoEn: string | null;
  /** Avance (%) del estudiante cuando la publicó. */
  progresoAlResenar: number;
  respuesta: RespuestaDocente | null;
  /** Último reporte del docente sobre esta reseña. */
  reporte: { estado: EstadoReporte; motivo: MotivoReporte } | null;
}

export interface EvolucionMes {
  /** AAAA-MM. */
  mes: string;
  /** Reseñas publicadas ese mes y su promedio. */
  total: number;
  promedio: number;
  /** Promedio de todas las reseñas hasta ese mes inclusive. */
  promedioAcumulado: number;
}

export interface BandejaResenas {
  cursos: { id: number; titulo: string }[];
  resumen: ResumenResenas & { sinResponder: number };
  evolucion: EvolucionMes[];
  items: ResenaDocente[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface ValoracionDocente {
  promedio: number | null;
  total: number;
}

// ------------------------------------------------------------ administrador

export type AccionHistorial = 'CREADA' | 'EDITADA' | 'ELIMINADA' | 'REPUBLICADA' | 'RESPONDIDA_POR_DOCENTE';

export interface EntradaHistorial {
  accion: AccionHistorial;
  fecha: string;
  /** Quién lo hizo; null si la operación no tenía autor (por ejemplo, un script de mantenimiento). */
  actor: { id: number; nombre: string } | null;
  estrellasAnterior: number | null;
  estrellasNueva: number | null;
  comentarioAnterior: string | null;
  comentarioNuevo: string | null;
}

/** Cualquier reseña, también las borradas, con su historial completo (vista del administrador). */
export interface ResenaAdmin {
  id: number;
  curso: { id: number; titulo: string };
  estudiante: string;
  estrellas: number;
  comentario: string | null;
  creadoEn: string;
  eliminadaEn: string | null;
  respuesta: RespuestaDocente | null;
  /** Reportes pendientes de esta reseña. */
  reportesPendientes: number;
  historial: EntradaHistorial[];
}

export interface PaginaResenasAdmin {
  items: ResenaAdmin[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface ReporteAdmin {
  id: number;
  motivo: MotivoReporte;
  detalle: string | null;
  estado: EstadoReporte;
  creadoEn: string;
  resueltoEn: string | null;
  reportadoPor: string;
  resena: {
    id: number;
    curso: { id: number; titulo: string };
    estudiante: string;
    estrellas: number;
    comentario: string | null;
    eliminadaEn: string | null;
    respuesta: RespuestaDocente | null;
  };
  historial: EntradaHistorial[];
}
