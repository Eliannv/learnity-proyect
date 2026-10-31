import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { DatosReporte, FiltrosBandeja, FiltrosReportes, FiltrosResenasAdmin } from './resenas.esquemas.js';
import type {
  AccionHistorial, EntradaHistorial, EstadoReporte, EvolucionMes, MotivoReporte, Ocultacion, ReporteAdmin, Resena,
  ResenaAdmin, ResenaDocente, ResumenResenas, ValoracionDocente,
} from './resenas.modelo.js';

// Una reseña pertenece a una inscripción (UNIQUE). Solo cuentan las de cursos publicados y las visibles:
// borrar es lógico (eliminado_en, lo hace su autor) y ocultar también (ocultada_en, lo hace un administrador),
// para conservar la información de reportes y moderación. El estudiante nunca toca ocultada_*.

/** Reseña que se ve en el curso: ni borrada por su autor ni ocultada por la moderación. */
const VISIBLE = 'r.eliminado_en IS NULL AND r.ocultada_en IS NULL';

/**
 * Motivo que se guarda al ocultar por un reporte. Es el mismo texto que genera la migración 036 y que su down
 * comprueba para revertir sin perder datos: si se cambia aquí, hay que cambiarlo allí.
 */
const MOTIVO_POR_REPORTE = `'Reporte del docente: ' || CASE x.motivo WHEN 'SPAM' THEN 'spam o publicidad'
                                                                     WHEN 'OFENSIVO' THEN 'lenguaje ofensivo'
                                                                     ELSE 'otro motivo' END`;

const CAMPOS = `
  r.id_resena AS id,
  trim(p.nombres || ' ' || COALESCE(left(p.apellidos, 1) || '.', '')) AS autor,
  p.foto_url AS "fotoUrl", r.estrellas, r.comentario, r.editado,
  r.creado_en AS "creadoEn", r.actualizado_en AS "actualizadoEn",
  r.respuesta_docente AS "respuestaTexto", r.respondida_en AS "respondidaEn"`;

interface FilaResena extends Omit<Resena, 'creadoEn' | 'actualizadoEn' | 'respuesta'> {
  creadoEn: Date;
  actualizadoEn: Date;
  respuestaTexto: string | null;
  respondidaEn: Date | null;
}

const respuesta = (texto: string | null, fecha: Date | null) =>
  (texto !== null && fecha !== null ? { texto, fecha: fecha.toISOString() } : null);

const publica = ({ respuestaTexto, respondidaEn, ...f }: FilaResena): Resena => ({
  ...f, creadoEn: f.creadoEn.toISOString(), actualizadoEn: f.actualizadoEn.toISOString(),
  respuesta: respuesta(respuestaTexto, respondidaEn),
});

const numeroONull = (valor: string | null) => (valor === null ? null : Number(valor));

/** Cursos del docente (activo); con `idCurso`, solo ese si es suyo. */
const CURSOS_DEL_DOCENTE = `
  SELECT c.id_curso FROM curso c JOIN docente d ON d.id_docente = c.id_docente
   WHERE d.id_persona = $1 AND d.estado = 'ACTIVO'`;

interface FilaDocente {
  id: number; cursoId: number; cursoTitulo: string; estudiante: string; fotoUrl: string | null;
  estrellas: number; comentario: string | null; creadoEn: Date; editado: boolean; editadoEn: Date | null;
  progresoAlResenar: number; respuestaTexto: string | null; respondidaEn: Date | null;
  reporteEstado: EstadoReporte | null; reporteMotivo: MotivoReporte | null;
}

/** Filtros de la bandeja como condiciones parametrizadas a partir de $2 ($1 es el docente). */
function condicionesBandeja(filtros: FiltrosBandeja): { sql: string; valores: unknown[] } {
  const partes: string[] = [];
  const valores: unknown[] = [];
  const agregar = (sql: (n: number) => string, valor: unknown) => {
    valores.push(valor);
    partes.push(sql(valores.length + 1));
  };
  if (filtros.curso !== undefined) agregar((n) => `i.id_curso = $${n}`, filtros.curso);
  if (filtros.estrellas !== undefined) agregar((n) => `r.estrellas = $${n}`, filtros.estrellas);
  if (filtros.comentario === 'con') partes.push('r.comentario IS NOT NULL');
  if (filtros.comentario === 'sin') partes.push('r.comentario IS NULL');
  if (filtros.respuesta === 'respondidas') partes.push('r.respuesta_docente IS NOT NULL');
  if (filtros.respuesta === 'sin-responder') partes.push('r.respuesta_docente IS NULL');
  if (filtros.categoria !== undefined) {
    agregar((n) => `EXISTS (SELECT 1 FROM curso cc JOIN categoria cat ON cat.id_categoria = cc.id_categoria
                             WHERE cc.id_curso = i.id_curso AND cat.nombre ILIKE $${n})`, literalLike(filtros.categoria));
  }
  if (filtros.q !== undefined) {
    agregar((n) => `(r.comentario ILIKE $${n} OR r.respuesta_docente ILIKE $${n}
                     OR EXISTS (SELECT 1 FROM persona pq WHERE pq.id_persona = i.id_persona
                                  AND concat_ws(' ', pq.nombres, pq.apellidos) ILIKE $${n}))`, literalLike(filtros.q));
  }
  return { sql: partes.map((p) => ` AND ${p}`).join(''), valores };
}

/** Reseña vista por el docente $1: su último reporte sobre ella y los datos del estudiante. */
const SELECT_DOCENTE = `
  SELECT r.id_resena AS id, c.id_curso AS "cursoId", c.titulo AS "cursoTitulo",
         concat_ws(' ', p.nombres, p.apellidos) AS estudiante, p.foto_url AS "fotoUrl",
         r.estrellas, r.comentario, r.creado_en AS "creadoEn", r.editado, r.editado_en AS "editadoEn",
         r.progreso_al_resenar AS "progresoAlResenar",
         r.respuesta_docente AS "respuestaTexto", r.respondida_en AS "respondidaEn",
         rep.estado AS "reporteEstado", rep.motivo AS "reporteMotivo"
    FROM resena r
    JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
    JOIN curso c ON c.id_curso = i.id_curso
    JOIN persona p ON p.id_persona = i.id_persona
    LEFT JOIN LATERAL (SELECT x.estado, x.motivo FROM reporte_resena x
                        WHERE x.id_resena = r.id_resena AND x.id_persona_reporta = $1
                        ORDER BY x.creado_en DESC, x.id_reporte DESC LIMIT 1) rep ON TRUE
   WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND ${VISIBLE}`;

const deDocente = (f: FilaDocente, originales: Map<number, number>): ResenaDocente => ({
  id: f.id, curso: { id: f.cursoId, titulo: f.cursoTitulo }, estudiante: f.estudiante, fotoUrl: f.fotoUrl,
  estrellas: f.estrellas, estrellasOriginales: originales.get(f.id) ?? f.estrellas,
  comentario: f.comentario, creadoEn: f.creadoEn.toISOString(), editado: f.editado,
  editadoEn: f.editadoEn?.toISOString() ?? null, progresoAlResenar: f.progresoAlResenar,
  respuesta: respuesta(f.respuestaTexto, f.respondidaEn),
  reporte: f.reporteEstado && f.reporteMotivo ? { estado: f.reporteEstado, motivo: f.reporteMotivo } : null,
});

// ------------------------------------------------------------ administrador

interface FilaOcultacion {
  ocultadaEn: Date | null; motivoOcultacion: string | null; ocultadaPorId: number | null; ocultadaPorNombre: string | null;
}

/** Requiere `LEFT JOIN persona po ON po.id_persona = r.ocultada_por`. */
const CAMPOS_OCULTACION = `
  r.ocultada_en AS "ocultadaEn", r.motivo_ocultacion AS "motivoOcultacion",
  po.id_persona AS "ocultadaPorId", concat_ws(' ', po.nombres, po.apellidos) AS "ocultadaPorNombre"`;

const ocultacion = (f: FilaOcultacion): Ocultacion | null => (f.ocultadaEn === null ? null : {
  fecha: f.ocultadaEn.toISOString(), motivo: f.motivoOcultacion ?? '',
  por: f.ocultadaPorId === null ? null : { id: f.ocultadaPorId, nombre: f.ocultadaPorNombre || 'Cuenta eliminada' },
});

interface FilaAdmin extends FilaOcultacion {
  id: number; cursoId: number; cursoTitulo: string; estudiante: string; estrellas: number;
  comentario: string | null; creadoEn: Date; eliminadaEn: Date | null; respuestaTexto: string | null;
  respondidaEn: Date | null; reportesPendientes: number; docentePersona: number; autorPersona: number;
}

/** Docente del curso y autor de la reseña: el servicio los compara con el administrador y no los envía. */
export interface Participantes { participantes: [docente: number, autor: number] }

/** Docente dueño del curso (alias c) y autor de la reseña (alias i). */
const CAMPOS_PARTICIPANTES = `(SELECT d.id_persona FROM docente d WHERE d.id_docente = c.id_docente) AS "docentePersona",
         i.id_persona AS "autorPersona"`;

const SELECT_ADMIN = `
  SELECT r.id_resena AS id, c.id_curso AS "cursoId", c.titulo AS "cursoTitulo",
         concat_ws(' ', p.nombres, p.apellidos) AS estudiante, r.estrellas, r.comentario,
         r.creado_en AS "creadoEn", r.eliminado_en AS "eliminadaEn",
         r.respuesta_docente AS "respuestaTexto", r.respondida_en AS "respondidaEn", ${CAMPOS_OCULTACION},
         ${CAMPOS_PARTICIPANTES},
         (SELECT count(*)::int FROM reporte_resena x
           WHERE x.id_resena = r.id_resena AND x.estado = 'PENDIENTE') AS "reportesPendientes"
    FROM resena r
    JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
    JOIN curso c ON c.id_curso = i.id_curso
    JOIN persona p ON p.id_persona = i.id_persona
    LEFT JOIN persona po ON po.id_persona = r.ocultada_por`;

const deAdmin = (f: FilaAdmin): Omit<ResenaAdmin, 'historial' | 'propia'> & Participantes => ({
  participantes: [f.docentePersona, f.autorPersona],
  id: f.id, curso: { id: f.cursoId, titulo: f.cursoTitulo }, estudiante: f.estudiante, estrellas: f.estrellas,
  comentario: f.comentario, creadoEn: f.creadoEn.toISOString(), eliminadaEn: f.eliminadaEn?.toISOString() ?? null,
  ocultacion: ocultacion(f), respuesta: respuesta(f.respuestaTexto, f.respondidaEn),
  reportesPendientes: f.reportesPendientes,
});

/** Escapa los comodines de LIKE para buscar el texto tal cual (la barra invertida es el escape por defecto). */
const literalLike = (texto: string) => `%${texto.replace(/[\\%_]/g, '\\$&')}%`;

/** Filtros del administrador como condiciones parametrizadas a partir de $1 (usan los alias r e i). */
function condicionesAdmin(
  filtros: Pick<FiltrosResenasAdmin, 'curso' | 'estrellas' | 'categoria' | 'q'> & { estado?: FiltrosResenasAdmin['estado'] },
): { sql: string; valores: unknown[] } {
  const partes: string[] = [];
  const valores: unknown[] = [];
  const agregar = (sql: (n: number) => string, valor: unknown) => {
    valores.push(valor);
    partes.push(sql(valores.length));
  };
  if (filtros.estado === 'vigentes') partes.push(VISIBLE);
  if (filtros.estado === 'borradas') partes.push('r.eliminado_en IS NOT NULL');
  if (filtros.estado === 'ocultadas') partes.push('r.ocultada_en IS NOT NULL');
  if (filtros.curso !== undefined) agregar((n) => `i.id_curso = $${n}`, filtros.curso);
  if (filtros.estrellas !== undefined) agregar((n) => `r.estrellas = $${n}`, filtros.estrellas);
  if (filtros.categoria !== undefined) {
    agregar((n) => `EXISTS (SELECT 1 FROM curso cc JOIN categoria cat ON cat.id_categoria = cc.id_categoria
                             WHERE cc.id_curso = i.id_curso AND cat.nombre ILIKE $${n})`, literalLike(filtros.categoria));
  }
  if (filtros.q !== undefined) {
    agregar((n) => `(r.comentario ILIKE $${n} OR r.respuesta_docente ILIKE $${n}
                     OR EXISTS (SELECT 1 FROM persona pq WHERE pq.id_persona = i.id_persona
                                  AND concat_ws(' ', pq.nombres, pq.apellidos) ILIKE $${n}))`, literalLike(filtros.q));
  }
  return { sql: partes.length ? partes.join(' AND ') : 'TRUE', valores };
}

export const resenasRepository = {
  async cursoPublicado(idCurso: number): Promise<boolean> {
    const { rows } = await consultar("SELECT 1 FROM curso WHERE id_curso = $1 AND estado = 'PUBLICADO'", [idCurso]);
    return rows.length === 1;
  },

  async resumen(idCurso: number): Promise<ResumenResenas> {
    const { rows } = await consultar<{ promedio: string | null; total: number; distribucion: number[] }>(
      `SELECT round(avg(r.estrellas), 1) AS promedio, count(*)::int AS total,
              ARRAY[count(*) FILTER (WHERE r.estrellas = 1), count(*) FILTER (WHERE r.estrellas = 2),
                    count(*) FILTER (WHERE r.estrellas = 3), count(*) FILTER (WHERE r.estrellas = 4),
                    count(*) FILTER (WHERE r.estrellas = 5)]::int[] AS distribucion
         FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
        WHERE i.id_curso = $1 AND ${VISIBLE}`,
      [idCurso],
    );
    const fila = rows[0]!;
    return { promedio: numeroONull(fila.promedio), total: fila.total, distribucion: fila.distribucion };
  },

  /** Primero las que tienen comentario y, dentro de ellas, las más recientes. */
  async pagina(idCurso: number, limite: number, offset: number): Promise<Resena[]> {
    const { rows } = await consultar<FilaResena>(
      `SELECT ${CAMPOS}
         FROM resena r
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN persona p ON p.id_persona = i.id_persona
        WHERE i.id_curso = $1 AND ${VISIBLE}
        ORDER BY (r.comentario IS NULL), r.actualizado_en DESC, r.id_resena DESC
        LIMIT $2 OFFSET $3`,
      [idCurso, limite, offset],
    );
    return rows.map(publica);
  },

  /** Inscripción del estudiante en el curso publicado (null si no puede reseñarlo). */
  async inscripcion(idPersona: number, idCurso: number): Promise<number | null> {
    const { rows } = await consultar<{ id: number }>(
      `SELECT i.id_inscripcion AS id
         FROM inscripcion i JOIN curso c ON c.id_curso = i.id_curso AND c.estado = 'PUBLICADO'
        WHERE i.id_persona = $1 AND i.id_curso = $2`,
      [idPersona, idCurso],
    );
    return rows[0]?.id ?? null;
  },

  async deInscripcion(idInscripcion: number): Promise<Resena | null> {
    const { rows } = await consultar<FilaResena>(
      `SELECT ${CAMPOS}
         FROM resena r
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN persona p ON p.id_persona = i.id_persona
        WHERE r.id_inscripcion = $1 AND ${VISIBLE}`,
      [idInscripcion],
    );
    return rows[0] ? publica(rows[0]) : null;
  },

  /** true si un administrador ocultó la reseña de esta inscripción. */
  async ocultadaDeInscripcion(idInscripcion: number): Promise<boolean> {
    const { rows } = await consultar(
      'SELECT 1 FROM resena WHERE id_inscripcion = $1 AND ocultada_en IS NOT NULL', [idInscripcion],
    );
    return rows.length === 1;
  },

  /**
   * Crea, edita o republica la reseña de la inscripción (UNIQUE id_inscripcion).
   * - Nueva o republicada: guarda el avance actual del estudiante y empieza sin marca de edición ni respuesta.
   * - Edición de una vigente: conserva fecha y avance originales; el trigger marca editado_en.
   * - Ocultada por un administrador: no cambia nada y devuelve false (ni editarla ni republicarla la vuelve visible).
   */
  async guardar(cliente: PoolClient, idInscripcion: number, estrellas: number, comentario: string | null): Promise<boolean> {
    const r = await cliente.query(
      `INSERT INTO resena (id_inscripcion, estrellas, comentario, progreso_al_resenar)
       VALUES ($1, $2, $3, (SELECT progreso_pct FROM inscripcion WHERE id_inscripcion = $1))
       ON CONFLICT (id_inscripcion) DO UPDATE SET
         estrellas = EXCLUDED.estrellas,
         comentario = EXCLUDED.comentario,
         progreso_al_resenar = CASE WHEN resena.eliminado_en IS NULL
                                    THEN resena.progreso_al_resenar ELSE EXCLUDED.progreso_al_resenar END,
         creado_en = CASE WHEN resena.eliminado_en IS NULL THEN resena.creado_en ELSE now() END,
         editado_en = CASE WHEN resena.eliminado_en IS NULL THEN resena.editado_en END,
         respuesta_docente = CASE WHEN resena.eliminado_en IS NULL THEN resena.respuesta_docente END,
         respondida_en = CASE WHEN resena.eliminado_en IS NULL THEN resena.respondida_en END,
         eliminado_en = NULL
       WHERE resena.ocultada_en IS NULL`,
      [idInscripcion, estrellas, comentario],
    );
    return r.rowCount === 1;
  },

  /** Borrado lógico: deja de contar en promedios públicos, pero se conserva para reportes. */
  async eliminar(cliente: PoolClient, idInscripcion: number): Promise<boolean> {
    const r = await cliente.query(
      'UPDATE resena SET eliminado_en = now() WHERE id_inscripcion = $1 AND eliminado_en IS NULL',
      [idInscripcion],
    );
    return r.rowCount === 1;
  },

  // ---------------------------------------------------------------- docente

  async cursosDelDocente(idPersona: number): Promise<{ id: number; titulo: string; estado: string; portadaUrl: string | null; iconoCategoria: string | null }[]> {
    const { rows } = await consultar<{ id: number; titulo: string; estado: string; portadaUrl: string | null; iconoCategoria: string | null }>(
      `SELECT c.id_curso AS id, c.titulo, c.estado, NULLIF(c.portada_url, '') AS "portadaUrl", cat.icono AS "iconoCategoria"
         FROM curso c
         JOIN docente d ON d.id_docente = c.id_docente
         LEFT JOIN categoria cat ON cat.id_categoria = c.id_categoria
        WHERE d.id_persona = $1 AND d.estado = 'ACTIVO' ORDER BY c.titulo, c.id_curso`,
      [idPersona],
    );
    return rows;
  },

  async bandeja(idPersona: number, filtros: FiltrosBandeja): Promise<{ items: ResenaDocente[]; total: number }> {
    const { sql, valores } = condicionesBandeja(filtros);
    const n = valores.length + 2;
    const [{ rows }, conteo] = await Promise.all([
      consultar<FilaDocente>(
        `${SELECT_DOCENTE}${sql} ORDER BY r.creado_en DESC, r.id_resena DESC LIMIT $${n} OFFSET $${n + 1}`,
        [idPersona, ...valores, filtros.limite, (filtros.pagina - 1) * filtros.limite],
      ),
      consultar<{ total: number }>(
        `SELECT count(*)::int AS total
           FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
          WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND ${VISIBLE}${sql}`,
        [idPersona, ...valores],
      ),
    ]);
    const originales = await this.estrellasOriginales(rows.map((f) => f.id));
    return { total: conteo.rows[0]!.total, items: rows.map((f) => deDocente(f, originales)) };
  },

  async resenaDocentePorId(idPersona: number, idResena: number): Promise<ResenaDocente | null> {
    const { rows } = await consultar<FilaDocente>(`${SELECT_DOCENTE} AND r.id_resena = $2`, [idPersona, idResena]);
    return rows[0] ? deDocente(rows[0], await this.estrellasOriginales([idResena])) : null;
  },

  /** Resumen de las reseñas vigentes del docente (de un curso, si se indica). */
  async resumenDocente(idPersona: number, idCurso?: number): Promise<ResumenResenas & { sinResponder: number }> {
    const { rows } = await consultar<{ promedio: string | null; total: number; distribucion: number[]; sinResponder: number }>(
      `SELECT round(avg(r.estrellas), 1) AS promedio, count(*)::int AS total,
              ARRAY[count(*) FILTER (WHERE r.estrellas = 1), count(*) FILTER (WHERE r.estrellas = 2),
                    count(*) FILTER (WHERE r.estrellas = 3), count(*) FILTER (WHERE r.estrellas = 4),
                    count(*) FILTER (WHERE r.estrellas = 5)]::int[] AS distribucion,
              count(*) FILTER (WHERE r.respuesta_docente IS NULL)::int AS "sinResponder"
         FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
        WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND ${VISIBLE}
          AND ($2::int IS NULL OR i.id_curso = $2)`,
      [idPersona, idCurso ?? null],
    );
    const f = rows[0]!;
    return { promedio: numeroONull(f.promedio), total: f.total, distribucion: f.distribucion, sinResponder: f.sinResponder };
  },

  /** Promedio mensual y acumulado de los últimos 12 meses con reseñas. */
  async evolucion(idPersona: number, idCurso?: number): Promise<EvolucionMes[]> {
    const { rows } = await consultar<{ mes: string; total: number; promedio: string; promedioAcumulado: string }>(
      `WITH mensual AS (
         SELECT date_trunc('month', r.creado_en) AS mes, count(*)::int AS total, sum(r.estrellas)::int AS suma
           FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
          WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND ${VISIBLE}
            AND ($2::int IS NULL OR i.id_curso = $2)
          GROUP BY 1
       ), acumulado AS (
         SELECT mes, total, round(suma::numeric / total, 2) AS promedio,
                round(sum(suma) OVER (ORDER BY mes)::numeric / sum(total) OVER (ORDER BY mes), 2) AS "promedioAcumulado"
           FROM mensual
       )
       SELECT to_char(mes, 'YYYY-MM') AS mes, total, promedio, "promedioAcumulado"
         FROM (SELECT * FROM acumulado ORDER BY mes DESC LIMIT 12) ultimos
        ORDER BY mes`,
      [idPersona, idCurso ?? null],
    );
    return rows.map((f) => ({
      mes: f.mes, total: f.total, promedio: Number(f.promedio), promedioAcumulado: Number(f.promedioAcumulado),
    }));
  },

  /** Valoración global del docente: reseñas vigentes de sus cursos publicados. */
  async valoracionDocente(idPersona: number): Promise<ValoracionDocente> {
    const { rows } = await consultar<{ promedio: string | null; total: number }>(
      `SELECT round(avg(r.estrellas), 1) AS promedio, count(r.id_resena)::int AS total
         FROM resena r
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN curso c ON c.id_curso = i.id_curso AND c.estado = 'PUBLICADO'
         JOIN docente d ON d.id_docente = c.id_docente
        WHERE d.id_persona = $1 AND ${VISIBLE}`,
      [idPersona],
    );
    return { promedio: numeroONull(rows[0]!.promedio), total: rows[0]!.total };
  },

  /** La reseña vigente si es de un curso del docente; bloquea la fila para responder o reportar. */
  async resenaDelDocente(cliente: PoolClient, idResena: number, idPersona: number): Promise<{ id: number } | null> {
    const { rows } = await cliente.query<{ id: number }>(
      `SELECT r.id_resena AS id FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
        WHERE r.id_resena = $2 AND ${VISIBLE} AND i.id_curso IN (${CURSOS_DEL_DOCENTE})
        FOR UPDATE OF r`,
      [idPersona, idResena],
    );
    return rows[0] ?? null;
  },

  async responder(cliente: PoolClient, idResena: number, texto: string | null): Promise<void> {
    await cliente.query(
      `UPDATE resena SET respuesta_docente = $2::varchar,
              respondida_en = CASE WHEN $2::varchar IS NULL THEN NULL ELSE now() END
        WHERE id_resena = $1`,
      [idResena, texto],
    );
  },

  /** true si ya hay un reporte pendiente de esa reseña. */
  async reportar(cliente: PoolClient, idResena: number, idPersona: number, datos: DatosReporte): Promise<boolean> {
    const r = await cliente.query(
      `INSERT INTO reporte_resena (id_resena, id_persona_reporta, motivo, detalle) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_resena) WHERE estado = 'PENDIENTE' DO NOTHING`,
      [idResena, idPersona, datos.motivo, datos.detalle],
    );
    return r.rowCount === 0;
  },

  // ---------------------------------------------------------------- historial

  async historial(ids: readonly number[]): Promise<Map<number, EntradaHistorial[]>> {
    const mapa = new Map<number, EntradaHistorial[]>();
    if (!ids.length) return mapa;
    const { rows } = await consultar<{
      idResena: number; accion: AccionHistorial; actorId: number | null; actorNombre: string | null; fecha: Date;
      estrellasAnterior: number | null; estrellasNueva: number | null;
      comentarioAnterior: string | null; comentarioNuevo: string | null; motivo: string | null;
    }>(
      `SELECT h.id_resena AS "idResena", h.accion, h.id_persona_actor AS "actorId",
              concat_ws(' ', p.nombres, p.apellidos) AS "actorNombre", h.fecha,
              h.estrellas_anterior AS "estrellasAnterior", h.estrellas_nueva AS "estrellasNueva",
              h.comentario_anterior AS "comentarioAnterior", h.comentario_nuevo AS "comentarioNuevo", h.motivo
         FROM historial_resena($1::int[]) h
         LEFT JOIN persona p ON p.id_persona = h.id_persona_actor`,
      [ids],
    );
    for (const f of rows) {
      const lista = mapa.get(f.idResena) ?? [];
      lista.push({
        accion: f.accion, fecha: f.fecha.toISOString(),
        actor: f.actorId === null ? null : { id: f.actorId, nombre: f.actorNombre || 'Cuenta eliminada' },
        estrellasAnterior: f.estrellasAnterior, estrellasNueva: f.estrellasNueva,
        comentarioAnterior: f.comentarioAnterior, comentarioNuevo: f.comentarioNuevo, motivo: f.motivo,
      });
      mapa.set(f.idResena, lista);
    }
    return mapa;
  },

  /** Estrellas con que se publicó cada reseña (la última creación o republicación). */
  async estrellasOriginales(ids: readonly number[]): Promise<Map<number, number>> {
    const mapa = new Map<number, number>();
    for (const [id, entradas] of await this.historial(ids)) {
      const publicacion = entradas.filter((e) => e.accion === 'CREADA' || e.accion === 'REPUBLICADA').at(-1);
      if (publicacion?.estrellasNueva != null) mapa.set(id, publicacion.estrellasNueva);
    }
    return mapa;
  },

  // ------------------------------------------------------------ administrador

  /** Reseñas de la plataforma con los filtros del administrador, de la más reciente a la más antigua. */
  async todas(filtros: FiltrosResenasAdmin): Promise<{ items: (Omit<ResenaAdmin, 'historial' | 'propia'> & Participantes)[]; total: number }> {
    const { sql, valores } = condicionesAdmin(filtros);
    const n = valores.length + 1;
    const [{ rows }, conteo] = await Promise.all([
      consultar<FilaAdmin>(
        `${SELECT_ADMIN} WHERE ${sql} ORDER BY r.actualizado_en DESC, r.id_resena DESC LIMIT $${n} OFFSET $${n + 1}`,
        [...valores, filtros.limite, (filtros.pagina - 1) * filtros.limite],
      ),
      consultar<{ total: number }>(
        `SELECT count(*)::int AS total FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
          WHERE ${sql}`,
        valores,
      ),
    ]);
    return { total: conteo.rows[0]!.total, items: rows.map(deAdmin) };
  },

  async resenaAdminPorId(idResena: number): Promise<(Omit<ResenaAdmin, 'historial' | 'propia'> & Participantes) | null> {
    const { rows } = await consultar<FilaAdmin>(`${SELECT_ADMIN} WHERE r.id_resena = $1`, [idResena]);
    return rows[0] ? deAdmin(rows[0]) : null;
  },

  /** Cursos con alguna reseña (para el filtro por curso del administrador). */
  async cursosConResenas(): Promise<{ id: number; titulo: string }[]> {
    const { rows } = await consultar<{ id: number; titulo: string }>(
      `SELECT c.id_curso AS id, c.titulo FROM curso c
        WHERE EXISTS (SELECT 1 FROM inscripcion i JOIN resena r ON r.id_inscripcion = i.id_inscripcion
                       WHERE i.id_curso = c.id_curso)
        ORDER BY c.titulo, c.id_curso`,
    );
    return rows;
  },

  async reportes(filtros: FiltrosReportes): Promise<(Omit<ReporteAdmin, 'historial' | 'propia'> & Participantes)[]> {
    // El estado del reporte va aparte ($n); de la reseña solo cuentan los filtros de contenido.
    const { sql, valores } = condicionesAdmin({ ...filtros, estado: 'todas' });
    const { rows } = await consultar<{
      id: number; motivo: MotivoReporte; detalle: string | null; estado: EstadoReporte; creadoEn: Date;
      resueltoEn: Date | null; reportadoPor: string; resenaId: number; cursoId: number; cursoTitulo: string;
      estudiante: string; estrellas: number; comentario: string | null; eliminadaEn: Date | null;
      respuestaTexto: string | null; respondidaEn: Date | null; docentePersona: number; autorPersona: number;
    } & FilaOcultacion>(
      `SELECT x.id_reporte AS id, x.motivo, x.detalle, x.estado, x.creado_en AS "creadoEn",
              x.resuelto_en AS "resueltoEn", concat_ws(' ', pr.nombres, pr.apellidos) AS "reportadoPor",
              r.id_resena AS "resenaId", c.id_curso AS "cursoId", c.titulo AS "cursoTitulo",
              concat_ws(' ', pe.nombres, pe.apellidos) AS estudiante, r.estrellas, r.comentario,
              r.eliminado_en AS "eliminadaEn", r.respuesta_docente AS "respuestaTexto", r.respondida_en AS "respondidaEn",
              ${CAMPOS_OCULTACION}, ${CAMPOS_PARTICIPANTES}
         FROM reporte_resena x
         JOIN persona pr ON pr.id_persona = x.id_persona_reporta
         JOIN resena r ON r.id_resena = x.id_resena
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN curso c ON c.id_curso = i.id_curso
         JOIN persona pe ON pe.id_persona = i.id_persona
         LEFT JOIN persona po ON po.id_persona = r.ocultada_por
        WHERE x.estado = $${valores.length + 1} AND ${sql}
        ORDER BY x.creado_en DESC, x.id_reporte DESC
        LIMIT 100`,
      [...valores, filtros.estado],
    );
    return rows.map((f) => ({
      participantes: [f.docentePersona, f.autorPersona] as [number, number],
      id: f.id, motivo: f.motivo, detalle: f.detalle, estado: f.estado, creadoEn: f.creadoEn.toISOString(),
      resueltoEn: f.resueltoEn?.toISOString() ?? null, reportadoPor: f.reportadoPor,
      resena: {
        id: f.resenaId, curso: { id: f.cursoId, titulo: f.cursoTitulo }, estudiante: f.estudiante,
        estrellas: f.estrellas, comentario: f.comentario, eliminadaEn: f.eliminadaEn?.toISOString() ?? null,
        ocultacion: ocultacion(f), respuesta: respuesta(f.respuestaTexto, f.respondidaEn),
      },
    }));
  },

  /** Resuelve un reporte pendiente; al ocultar, oculta la reseña (si no lo estaba). Devuelve la reseña o null. */
  async resolverReporte(cliente: PoolClient, idReporte: number, idAdmin: number, ocultar: boolean): Promise<number | null> {
    const { rows } = await cliente.query<{ resena: number }>(
      `UPDATE reporte_resena SET estado = $3, resuelto_en = now(), id_persona_resuelve = $2
        WHERE id_reporte = $1 AND estado = 'PENDIENTE'
        RETURNING id_resena AS resena`,
      [idReporte, idAdmin, ocultar ? 'OCULTADA' : 'DESESTIMADA'],
    );
    const idResena = rows[0]?.resena ?? null;
    if (idResena !== null && ocultar) {
      await cliente.query(
        `UPDATE resena r SET ocultada_en = x.resuelto_en, ocultada_por = x.id_persona_resuelve,
                motivo_ocultacion = ${MOTIVO_POR_REPORTE}
           FROM reporte_resena x
          WHERE x.id_reporte = $1 AND r.id_resena = x.id_resena AND r.ocultada_en IS NULL`,
        [idReporte],
      );
    }
    return idResena;
  },

  /** Bloquea la reseña para moderarla: si está oculta y si tiene respuesta del docente (null si no existe). */
  async bloquearParaModerar(cliente: PoolClient, idResena: number): Promise<{ ocultada: boolean; respondida: boolean; idPersonaDocente: number; idPersonaAutor: number } | null> {
    const { rows } = await cliente.query<{ ocultada: boolean; respondida: boolean; idPersonaDocente: number; idPersonaAutor: number }>(
      `SELECT r.ocultada_en IS NOT NULL AS ocultada, r.respuesta_docente IS NOT NULL AS respondida,
              d.id_persona AS "idPersonaDocente", i.id_persona AS "idPersonaAutor"
         FROM resena r
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN curso c ON c.id_curso = i.id_curso
         JOIN docente d ON d.id_docente = c.id_docente
        WHERE r.id_resena = $1
          FOR UPDATE OF r`,
      [idResena],
    );
    return rows[0] ?? null;
  },

  /** Docente del curso y autor de la reseña de un reporte pendiente (null si no existe o ya se resolvió). */
  async partesDeReportePendiente(cliente: PoolClient, idReporte: number): Promise<{ idPersonaDocente: number; idPersonaAutor: number } | null> {
    const { rows } = await cliente.query<{ idPersonaDocente: number; idPersonaAutor: number }>(
      `SELECT d.id_persona AS "idPersonaDocente", i.id_persona AS "idPersonaAutor"
         FROM reporte_resena x
         JOIN resena r ON r.id_resena = x.id_resena
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN curso c ON c.id_curso = i.id_curso
         JOIN docente d ON d.id_docente = c.id_docente
        WHERE x.id_reporte = $1 AND x.estado = 'PENDIENTE'
          FOR UPDATE OF x`,
      [idReporte],
    );
    return rows[0] ?? null;
  },

  /** Oculta la reseña con el motivo del administrador y resuelve como OCULTADA sus reportes pendientes. */
  async ocultar(cliente: PoolClient, idResena: number, idAdmin: number, motivo: string): Promise<void> {
    await cliente.query(
      `UPDATE resena SET ocultada_en = now(), ocultada_por = $2, motivo_ocultacion = $3
        WHERE id_resena = $1 AND ocultada_en IS NULL`,
      [idResena, idAdmin, motivo],
    );
    await cliente.query(
      `UPDATE reporte_resena SET estado = 'OCULTADA', resuelto_en = now(), id_persona_resuelve = $2
        WHERE id_resena = $1 AND estado = 'PENDIENTE'`,
      [idResena, idAdmin],
    );
  },

  /** Vuelve a mostrar la reseña. Los reportes resueltos conservan su estado como registro. */
  async restaurar(cliente: PoolClient, idResena: number): Promise<void> {
    await cliente.query(
      `UPDATE resena SET ocultada_en = NULL, ocultada_por = NULL, motivo_ocultacion = NULL
        WHERE id_resena = $1 AND ocultada_en IS NOT NULL`,
      [idResena],
    );
  },

  /** Retira la respuesta del docente; la auditoría guarda el texto y quién la retiró. */
  async retirarRespuesta(cliente: PoolClient, idResena: number): Promise<void> {
    await cliente.query(
      `UPDATE resena SET respuesta_docente = NULL, respondida_en = NULL
        WHERE id_resena = $1 AND respuesta_docente IS NOT NULL`,
      [idResena],
    );
  },
};
