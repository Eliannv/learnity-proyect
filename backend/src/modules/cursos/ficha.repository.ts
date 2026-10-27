import type { PoolClient } from 'pg';

import { consultar } from '../../shared/database/pool.js';

import type {
  ContextoCurso,
  CursoDetalle,
  CursoResumen,
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
  docente: string;
}

export const fichaRepository = {
  async listarDelDocente(idPersona: number): Promise<CursoResumen[]> {
    const { rows } = await consultar<CursoResumen>(
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
          NULLIF(c.portada_url, '') AS "portadaUrl"
        FROM curso c
        JOIN docente d
          ON d.id_docente = c.id_docente
        JOIN persona p
          ON p.id_persona = d.id_persona
        WHERE d.id_persona = $1
          AND d.estado = 'ACTIVO'
        ORDER BY c.creado_en DESC, c.id_curso DESC
      `,
      [idPersona],
    );

    return rows;
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

  async pendientes(): Promise<CursoResumen[]> {
    const { rows } = await consultar<CursoResumen>(
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
          NULLIF(c.portada_url, '') AS "portadaUrl"
        FROM curso c
        JOIN docente d
          ON d.id_docente = c.id_docente
        JOIN persona p
          ON p.id_persona = d.id_persona
        WHERE c.estado = 'EN_REVISION'
        ORDER BY c.creado_en, c.id_curso
      `,
    );

    return rows;
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
};
