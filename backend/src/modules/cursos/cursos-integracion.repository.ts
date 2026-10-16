import type { PoolClient } from 'pg';

import { consultar } from '../../shared/database/pool.js';

import type {
  ContextoCurso,
  ContextoLeccion,
  CursoDetalle,
  CursoResumen,
  TipoLeccion,
} from './cursos-privados.model.js';

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

export interface FilaTemario {
  moduloId: number;
  moduloTitulo: string;
  moduloOrden: number;

  leccionId: number | null;
  leccionTitulo: string | null;
  leccionOrden: number | null;
  leccionTipo: TipoLeccion | null;

  archivoId: number | null;
  archivoTipo: string | null;
  archivoNombre: string | null;
  archivoRuta: string | null;
  archivoTamano: number | null;
}

export const cursosIntegracionRepository = {
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
          ) AS modulos
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

  async leccion(
    cliente: PoolClient,
    id: number,
    bloquear = false,
  ): Promise<ContextoLeccion | null> {
    const { rows } = await cliente.query<ContextoLeccion>(
      `
        SELECT
          c.id_curso AS id,
          c.estado,
          d.id_persona AS "idPersonaDocente",
          (d.estado = 'ACTIVO') AS "docenteActivo",

          l.id_leccion AS "leccionId",
          l.tipo AS "tipoLeccion",
          l.id_archivo AS "archivoId"
        FROM leccion l
        JOIN modulo m
          ON m.id_modulo = l.id_modulo
        JOIN curso c
          ON c.id_curso = m.id_curso
        JOIN docente d
          ON d.id_docente = c.id_docente
        WHERE l.id_leccion = $1
        ${bloquear ? 'FOR UPDATE OF c, l' : ''}
      `,
      [id],
    );

    return rows[0] ?? null;
  },

  async temario(
    cliente: PoolClient,
    id: number,
  ): Promise<FilaTemario[]> {
    const { rows } = await cliente.query<FilaTemario>(
      `
        SELECT
          m.id_modulo AS "moduloId",
          m.titulo AS "moduloTitulo",
          m.orden AS "moduloOrden",

          l.id_leccion AS "leccionId",
          l.titulo AS "leccionTitulo",
          l.orden AS "leccionOrden",
          l.tipo AS "leccionTipo",

          a.id_archivo AS "archivoId",
          a.tipo AS "archivoTipo",
          a.nombre_original AS "archivoNombre",
          a.ruta AS "archivoRuta",
          a.tamano_bytes AS "archivoTamano"
        FROM modulo m
        LEFT JOIN leccion l
          ON l.id_modulo = m.id_modulo
        LEFT JOIN archivo a
          ON a.id_archivo = l.id_archivo
          AND a.id_curso = m.id_curso
        WHERE m.id_curso = $1
        ORDER BY
          m.orden,
          m.id_modulo,
          l.orden,
          l.id_leccion
      `,
      [id],
    );

    return rows;
  },

  async asociarPdf(
    cliente: PoolClient,
    contexto: ContextoLeccion,
    archivoId: number,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        UPDATE leccion l
        SET id_archivo = $1
        WHERE l.id_leccion = $2
          AND l.tipo = 'DOCUMENTO'
          AND EXISTS (
            SELECT 1
            FROM modulo m
            WHERE m.id_modulo = l.id_modulo
              AND m.id_curso = $3
          )
          AND EXISTS (
            SELECT 1
            FROM archivo a
            WHERE a.id_archivo = $1
              AND a.id_curso = $3
              AND a.tipo = 'PDF'
          )
      `,
      [
        archivoId,
        contexto.leccionId,
        contexto.id,
      ],
    );

    return resultado.rowCount === 1;
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