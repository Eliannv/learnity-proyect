import type { PoolClient } from 'pg';

import { consultar } from '../../shared/database/pool.js';

import type {
  ContextoCurso,
  CursoDetalle,
  CursoDelDocente,
  CursoResumen,
  CursoRevision,
  EstadoRevision,
} from './cursos.modelo.js';

export interface BasePrivada extends ContextoCurso {
  titulo: string;
  subtitulo: string;
  descripcion: string;

  categoriaId: number;
  categoriaNombre: string;
  categoriaActiva: boolean;

  nivel: CursoDetalle['nivel'];
  portadaUrl: string;

  objetivos: string[];
  requisitos: string[];

  motivoRechazo: string | null;
  suspendidoEn: Date | null;
  motivoSuspension: string | null;
  docente: string;
}

export const fichaRepository = {
  async listarDelDocente(idPersona: number): Promise<CursoDelDocente[]> {
    const { rows } = await consultar<CursoResumen & { estudiantes: number; promedio: string | null; resenas: number }>(
      `
        SELECT
          c.id_curso AS id,
          c.titulo,
          c.estado,
          c.motivo_rechazo AS "motivoRechazo",
          concat_ws(' ', p.nombres, p.apellidos) AS docente,
          (
            SELECT count(*)::int
            FROM modulo m
            WHERE m.id_curso = c.id_curso
          ) AS modulos,
          NULLIF(c.portada_url, '') AS "portadaUrl",
          (
            SELECT count(*)::int
            FROM inscripcion i
            WHERE i.id_curso = c.id_curso
          ) AS estudiantes,
          v.promedio,
          v.resenas
        FROM curso c
        JOIN docente d
          ON d.id_docente = c.id_docente
        JOIN persona p
          ON p.id_persona = d.id_persona
        CROSS JOIN LATERAL (
          -- Solo reseñas visibles: las borradas y las ocultadas no cuentan en el promedio.
          SELECT round(avg(r.estrellas), 1) AS promedio, count(r.id_resena)::int AS resenas
          FROM resena r
          JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
          WHERE i.id_curso = c.id_curso
            AND r.eliminado_en IS NULL AND r.ocultada_en IS NULL
        ) v
        WHERE d.id_persona = $1
          AND d.estado = 'ACTIVO'
        ORDER BY c.creado_en DESC, c.id_curso DESC
      `,
      [idPersona],
    );

    return rows.map(({ promedio, resenas, ...curso }) => ({
      ...curso,
      calificacion: { promedio: promedio === null ? null : Number(promedio), total: resenas },
    }));
  },

  async docentePorPersona(
    cliente: PoolClient,
    idPersona: number,
  ): Promise<number | null> {
    const { rows } = await cliente.query<{
      id: number;
    }>(
      `
        SELECT id_docente AS id
        FROM docente
        WHERE id_persona = $1
          AND estado = 'ACTIVO'
      `,
      [idPersona],
    );

    return rows[0]?.id ?? null;
  },

  async categoriaActiva(
    cliente: PoolClient,
    categoriaId: number,
  ): Promise<boolean> {
    const { rows } = await cliente.query(
      `
        SELECT 1
        FROM categoria
        WHERE id_categoria = $1
          AND activa = TRUE
      `,
      [categoriaId],
    );

    return rows.length > 0;
  },

  async crearBorrador(
    cliente: PoolClient,
    idDocente: number,
    datos: {
      titulo: string;
      subtitulo: string;
      descripcion: string;
      categoriaId: number;
      nivel: 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
      portadaUrl: string;
      objetivos: string[];
      requisitos: string[];
    },
  ): Promise<number> {
    const { rows } = await cliente.query<{
      id: number;
    }>(
      `
        INSERT INTO curso (
          id_docente,
          id_categoria,
          titulo,
          subtitulo,
          descripcion,
          nivel,
          portada_url,
          objetivos,
          requisitos,
          estado
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8::text[], $9::text[],
          'BORRADOR'
        )
        RETURNING id_curso AS id
      `,
      [
        idDocente,
        datos.categoriaId,
        datos.titulo,
        datos.subtitulo,
        datos.descripcion,
        datos.nivel,
        datos.portadaUrl,
        datos.objetivos,
        datos.requisitos,
      ],
    );

    return rows[0]!.id;
  },

  async actualizarCurso(
    cliente: PoolClient,
    idCurso: number,
    datos: {
      titulo: string;
      subtitulo: string;
      descripcion: string;
      categoriaId: number;
      nivel: 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
      portadaUrl: string;
      objetivos: string[];
      requisitos: string[];
    },
  ): Promise<void> {
    await cliente.query(
      `
        UPDATE curso
        SET
          titulo = $2,
          subtitulo = $3,
          descripcion = $4,
          id_categoria = $5,
          nivel = $6,
          portada_url = $7,
          objetivos = $8::text[],
          requisitos = $9::text[]
        WHERE id_curso = $1
      `,
      [
        idCurso,
        datos.titulo,
        datos.subtitulo,
        datos.descripcion,
        datos.categoriaId,
        datos.nivel,
        datos.portadaUrl,
        datos.objetivos,
        datos.requisitos,
      ],
    );
  },

  async enviarARevision(
    cliente: PoolClient,
    idCurso: number,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        UPDATE curso
        SET
          estado = 'EN_REVISION',
          motivo_rechazo = NULL,
          revisado_por = NULL
        WHERE id_curso = $1
          AND estado IN ('BORRADOR', 'RECHAZADO')
      `,
      [idCurso],
    );

    return resultado.rowCount === 1;
  },

  /**
   * Cursos de un estado para Revisión de cursos. Los pendientes, el más antiguo primero (se revisan por orden de
   * llegada); los demás, el modificado más recientemente primero. Como mucho 200.
   */
  async listarParaRevision(estado: EstadoRevision): Promise<CursoRevision[]> {
    const orden = estado === 'EN_REVISION' ? 'c.creado_en, c.id_curso' : 'c.actualizado_en DESC, c.id_curso DESC';
    const { rows } = await consultar<CursoResumen & {
      inscritos: number; actualizadoEn: Date; suspendidoEn: Date | null; motivoSuspension: string | null;
    }>(
      `
        SELECT
          c.id_curso AS id,
          c.titulo,
          c.estado,
          c.motivo_rechazo AS "motivoRechazo",
          concat_ws(
            ' ',
            p.nombres,
            p.apellidos
          ) AS docente,
          (
            SELECT count(*)::int
            FROM modulo m
            WHERE m.id_curso = c.id_curso
          ) AS modulos,
          NULLIF(c.portada_url, '') AS "portadaUrl",
          (SELECT count(*)::int FROM inscripcion i WHERE i.id_curso = c.id_curso) AS inscritos,
          c.actualizado_en AS "actualizadoEn",
          c.suspendido_en AS "suspendidoEn",
          c.motivo_suspension AS "motivoSuspension"
        FROM curso c
        JOIN docente d
          ON d.id_docente = c.id_docente
        JOIN persona p
          ON p.id_persona = d.id_persona
        WHERE c.estado = $1
        ORDER BY ${orden}
        LIMIT 200
      `,
      [estado],
    );

    return rows.map(({ actualizadoEn, suspendidoEn, motivoSuspension, ...curso }) => ({
      ...curso,
      actualizadoEn: actualizadoEn.toISOString(),
      suspension: suspendidoEn && motivoSuspension ? { suspendidoEn: suspendidoEn.toISOString(), motivo: motivoSuspension } : null,
    }));
  },

  /** Cuántos cursos hay en cada pestaña de Revisión de cursos. */
  async conteosRevision(): Promise<Record<EstadoRevision, number>> {
    const { rows: [f] } = await consultar<Record<EstadoRevision, number>>(
      `SELECT count(*) FILTER (WHERE estado = 'EN_REVISION')::int AS "EN_REVISION",
              count(*) FILTER (WHERE estado = 'PUBLICADO')::int   AS "PUBLICADO",
              count(*) FILTER (WHERE estado = 'SUSPENDIDO')::int  AS "SUSPENDIDO",
              count(*) FILTER (WHERE estado = 'RECHAZADO')::int   AS "RECHAZADO",
              count(*) FILTER (WHERE estado = 'BORRADOR')::int    AS "BORRADOR"
         FROM curso`,
    );
    return f!;
  },

  /** PUBLICADO → SUSPENDIDO con quién, cuándo y por qué. false si otro administrador cambió el estado antes. */
  async suspender(cliente: PoolClient, id: number, motivo: string, admin: number): Promise<boolean> {
    const r = await cliente.query(
      `UPDATE curso
          SET estado = 'SUSPENDIDO', suspendido_en = now(), suspendido_por = $3, motivo_suspension = $2
        WHERE id_curso = $1 AND estado = 'PUBLICADO'`,
      [id, motivo, admin],
    );
    return r.rowCount === 1;
  },

  /** SUSPENDIDO → PUBLICADO. Conserva revisado_por y publicado_en; el historial de la suspensión queda en la auditoría. */
  async reactivar(cliente: PoolClient, id: number): Promise<boolean> {
    const r = await cliente.query(
      `UPDATE curso
          SET estado = 'PUBLICADO', suspendido_en = NULL, suspendido_por = NULL, motivo_suspension = NULL
        WHERE id_curso = $1 AND estado = 'SUSPENDIDO'`,
      [id],
    );
    return r.rowCount === 1;
  },

  async base(
    cliente: PoolClient,
    id: number,
    bloquear = false,
  ): Promise<BasePrivada | null> {
    const { rows } = await cliente.query<BasePrivada>(
      `
        SELECT
          c.id_curso AS id,
          c.estado,
          d.id_persona AS "idPersonaDocente",
          (d.estado = 'ACTIVO') AS "docenteActivo",

          c.titulo,
          COALESCE(c.subtitulo, '') AS subtitulo,
          COALESCE(c.descripcion, '') AS descripcion,

          c.id_categoria AS "categoriaId",
          cat.nombre AS "categoriaNombre",
          cat.activa AS "categoriaActiva",

          c.nivel,
          COALESCE(c.portada_url, '') AS "portadaUrl",

          c.objetivos,
          c.requisitos,
          c.motivo_rechazo AS "motivoRechazo",
          c.suspendido_en AS "suspendidoEn",
          c.motivo_suspension AS "motivoSuspension",

          concat_ws(
            ' ',
            p.nombres,
            p.apellidos
          ) AS docente
        FROM curso c
        JOIN docente d
          ON d.id_docente = c.id_docente
        JOIN persona p
          ON p.id_persona = d.id_persona
        JOIN categoria cat
          ON cat.id_categoria = c.id_categoria
        WHERE c.id_curso = $1
        ${bloquear ? 'FOR UPDATE OF c' : ''}
      `,
      [id],
    );

    return rows[0] ?? null;
  },

  async decidir(
    cliente: PoolClient,
    id: number,
    estado: 'PUBLICADO' | 'RECHAZADO',
    motivo: string | null,
    revisor: number,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        UPDATE curso
        SET
          estado = $2::varchar,
          motivo_rechazo = $3,
          revisado_por = $4,
          publicado_en = CASE
            WHEN $2::varchar = 'PUBLICADO'
              THEN now()
            ELSE NULL
          END
        WHERE id_curso = $1
          AND estado = 'EN_REVISION'
      `,
      [
        id,
        estado,
        motivo,
        revisor,
      ],
    );

    return resultado.rowCount === 1;
  },

  /** Correo y nombre del docente de un curso, para avisarle de la decisión de revisión. */
  async contactoDocente(idCurso: number): Promise<{ correo: string; nombres: string } | null> {
    const { rows } = await consultar<{ correo: string; nombres: string }>(
      `SELECT u.correo, p.nombres
         FROM curso c
         JOIN docente d ON d.id_docente = c.id_docente
         JOIN persona p ON p.id_persona = d.id_persona
         JOIN usuario u ON u.id_persona = p.id_persona
        WHERE c.id_curso = $1`,
      [idCurso],
    );
    return rows[0] ?? null;
  },
};
