import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { DatosReporte, FiltrosBandeja, FiltrosResenasAdmin } from './resenas.esquemas.js';
import type {
  AccionHistorial, EntradaHistorial, EstadoReporte, EvolucionMes, MotivoReporte, ReporteAdmin, Resena, ResenaAdmin,
  ResenaDocente, ResumenResenas, ValoracionDocente,
} from './resenas.modelo.js';

// Una reseña pertenece a una inscripción (UNIQUE). Solo cuentan las de cursos publicados y las no borradas:
// borrar es lógico (eliminado_en), para conservar la información de reportes y moderación.

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
   WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND r.eliminado_en IS NULL`;

const deDocente = (f: FilaDocente, originales: Map<number, number>): ResenaDocente => ({
  id: f.id, curso: { id: f.cursoId, titulo: f.cursoTitulo }, estudiante: f.estudiante, fotoUrl: f.fotoUrl,
  estrellas: f.estrellas, estrellasOriginales: originales.get(f.id) ?? f.estrellas,
  comentario: f.comentario, creadoEn: f.creadoEn.toISOString(), editado: f.editado,
  editadoEn: f.editadoEn?.toISOString() ?? null, progresoAlResenar: f.progresoAlResenar,
  respuesta: respuesta(f.respuestaTexto, f.respondidaEn),
  reporte: f.reporteEstado && f.reporteMotivo ? { estado: f.reporteEstado, motivo: f.reporteMotivo } : null,
});

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
        WHERE i.id_curso = $1 AND r.eliminado_en IS NULL`,
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
        WHERE i.id_curso = $1 AND r.eliminado_en IS NULL
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
        WHERE r.id_inscripcion = $1 AND r.eliminado_en IS NULL`,
      [idInscripcion],
    );
    return rows[0] ? publica(rows[0]) : null;
  },

  /**
   * Crea, edita o republica la reseña de la inscripción (UNIQUE id_inscripcion).
   * - Nueva o republicada: guarda el avance actual del estudiante y empieza sin marca de edición ni respuesta.
   * - Edición de una vigente: conserva fecha y avance originales; el trigger marca editado_en.
   */
  async guardar(cliente: PoolClient, idInscripcion: number, estrellas: number, comentario: string | null): Promise<void> {
    await cliente.query(
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
         eliminado_en = NULL`,
      [idInscripcion, estrellas, comentario],
    );
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
          WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND r.eliminado_en IS NULL${sql}`,
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
        WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND r.eliminado_en IS NULL
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
          WHERE i.id_curso IN (${CURSOS_DEL_DOCENTE}) AND r.eliminado_en IS NULL
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
        WHERE d.id_persona = $1 AND r.eliminado_en IS NULL`,
      [idPersona],
    );
    return { promedio: numeroONull(rows[0]!.promedio), total: rows[0]!.total };
  },

  /** La reseña vigente si es de un curso del docente; bloquea la fila para responder o reportar. */
  async resenaDelDocente(cliente: PoolClient, idResena: number, idPersona: number): Promise<{ id: number } | null> {
    const { rows } = await cliente.query<{ id: number }>(
      `SELECT r.id_resena AS id FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
        WHERE r.id_resena = $2 AND r.eliminado_en IS NULL AND i.id_curso IN (${CURSOS_DEL_DOCENTE})
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
      comentarioAnterior: string | null; comentarioNuevo: string | null;
    }>(
      `SELECT h.id_resena AS "idResena", h.accion, h.id_persona_actor AS "actorId",
              concat_ws(' ', p.nombres, p.apellidos) AS "actorNombre", h.fecha,
              h.estrellas_anterior AS "estrellasAnterior", h.estrellas_nueva AS "estrellasNueva",
              h.comentario_anterior AS "comentarioAnterior", h.comentario_nuevo AS "comentarioNuevo"
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
        comentarioAnterior: f.comentarioAnterior, comentarioNuevo: f.comentarioNuevo,
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

  /** Todas las reseñas de la plataforma (vigentes, borradas o ambas), de la más reciente a la más antigua. */
  async todas({ estado, pagina, limite }: FiltrosResenasAdmin): Promise<{ items: Omit<ResenaAdmin, 'historial'>[]; total: number }> {
    const condicion = estado === 'vigentes' ? 'r.eliminado_en IS NULL'
      : estado === 'borradas' ? 'r.eliminado_en IS NOT NULL' : 'TRUE';
    const [{ rows }, conteo] = await Promise.all([
      consultar<{
        id: number; cursoId: number; cursoTitulo: string; estudiante: string; estrellas: number;
        comentario: string | null; creadoEn: Date; eliminadaEn: Date | null; respuestaTexto: string | null;
        respondidaEn: Date | null; reportesPendientes: number;
      }>(
        `SELECT r.id_resena AS id, c.id_curso AS "cursoId", c.titulo AS "cursoTitulo",
                concat_ws(' ', p.nombres, p.apellidos) AS estudiante, r.estrellas, r.comentario,
                r.creado_en AS "creadoEn", r.eliminado_en AS "eliminadaEn",
                r.respuesta_docente AS "respuestaTexto", r.respondida_en AS "respondidaEn",
                (SELECT count(*)::int FROM reporte_resena x
                  WHERE x.id_resena = r.id_resena AND x.estado = 'PENDIENTE') AS "reportesPendientes"
           FROM resena r
           JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
           JOIN curso c ON c.id_curso = i.id_curso
           JOIN persona p ON p.id_persona = i.id_persona
          WHERE ${condicion}
          ORDER BY r.actualizado_en DESC, r.id_resena DESC
          LIMIT $1 OFFSET $2`,
        [limite, (pagina - 1) * limite],
      ),
      consultar<{ total: number }>(`SELECT count(*)::int AS total FROM resena r WHERE ${condicion}`),
    ]);
    return {
      total: conteo.rows[0]!.total,
      items: rows.map((f) => ({
        id: f.id, curso: { id: f.cursoId, titulo: f.cursoTitulo }, estudiante: f.estudiante, estrellas: f.estrellas,
        comentario: f.comentario, creadoEn: f.creadoEn.toISOString(), eliminadaEn: f.eliminadaEn?.toISOString() ?? null,
        respuesta: respuesta(f.respuestaTexto, f.respondidaEn), reportesPendientes: f.reportesPendientes,
      })),
    };
  },

  async reportes(estado: EstadoReporte): Promise<Omit<ReporteAdmin, 'historial'>[]> {
    const { rows } = await consultar<{
      id: number; motivo: MotivoReporte; detalle: string | null; estado: EstadoReporte; creadoEn: Date;
      resueltoEn: Date | null; reportadoPor: string; resenaId: number; cursoId: number; cursoTitulo: string;
      estudiante: string; estrellas: number; comentario: string | null; eliminadaEn: Date | null;
      respuestaTexto: string | null; respondidaEn: Date | null;
    }>(
      `SELECT x.id_reporte AS id, x.motivo, x.detalle, x.estado, x.creado_en AS "creadoEn",
              x.resuelto_en AS "resueltoEn", concat_ws(' ', pr.nombres, pr.apellidos) AS "reportadoPor",
              r.id_resena AS "resenaId", c.id_curso AS "cursoId", c.titulo AS "cursoTitulo",
              concat_ws(' ', pe.nombres, pe.apellidos) AS estudiante, r.estrellas, r.comentario,
              r.eliminado_en AS "eliminadaEn", r.respuesta_docente AS "respuestaTexto", r.respondida_en AS "respondidaEn"
         FROM reporte_resena x
         JOIN persona pr ON pr.id_persona = x.id_persona_reporta
         JOIN resena r ON r.id_resena = x.id_resena
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN curso c ON c.id_curso = i.id_curso
         JOIN persona pe ON pe.id_persona = i.id_persona
        WHERE x.estado = $1
        ORDER BY x.creado_en DESC, x.id_reporte DESC
        LIMIT 100`,
      [estado],
    );
    return rows.map((f) => ({
      id: f.id, motivo: f.motivo, detalle: f.detalle, estado: f.estado, creadoEn: f.creadoEn.toISOString(),
      resueltoEn: f.resueltoEn?.toISOString() ?? null, reportadoPor: f.reportadoPor,
      resena: {
        id: f.resenaId, curso: { id: f.cursoId, titulo: f.cursoTitulo }, estudiante: f.estudiante,
        estrellas: f.estrellas, comentario: f.comentario, eliminadaEn: f.eliminadaEn?.toISOString() ?? null,
        respuesta: respuesta(f.respuestaTexto, f.respondidaEn),
      },
    }));
  },

  /** Resuelve un reporte pendiente; al ocultar, borra lógicamente la reseña. Devuelve la reseña o null. */
  async resolverReporte(cliente: PoolClient, idReporte: number, idAdmin: number, ocultar: boolean): Promise<number | null> {
    const { rows } = await cliente.query<{ resena: number }>(
      `UPDATE reporte_resena SET estado = $3, resuelto_en = now(), id_persona_resuelve = $2
        WHERE id_reporte = $1 AND estado = 'PENDIENTE'
        RETURNING id_resena AS resena`,
      [idReporte, idAdmin, ocultar ? 'OCULTADA' : 'DESESTIMADA'],
    );
    const idResena = rows[0]?.resena ?? null;
    if (idResena !== null && ocultar) {
      await cliente.query('UPDATE resena SET eliminado_en = now() WHERE id_resena = $1 AND eliminado_en IS NULL', [idResena]);
    }
    return idResena;
  },
};
