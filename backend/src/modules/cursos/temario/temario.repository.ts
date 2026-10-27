import type { PoolClient } from 'pg';
import { consultar } from '../../../shared/database/pool.js';

import type {
  ContextoLeccion,
  TipoLeccion,
} from '../cursos.modelo.js';
import type { DatosLeccion } from './temario.esquemas.js';

export interface FilaTemario {
  moduloId: number;
  moduloTitulo: string;
  moduloOrden: number;

  leccionId: number | null;
  leccionTitulo: string | null;
  leccionOrden: number | null;
  leccionTipo: TipoLeccion | null;
  youtubeVideoId: string | null;
  vistaPrevia: boolean | null;
  preguntas: number;

  archivoId: number | null;
  archivoTipo: string | null;
  archivoNombre: string | null;
  archivoRuta: string | null;
  archivoTamano: number | null;
}

export interface ArchivoCursoFila {
  id: number;
  ruta: string;
  tamano: number;
}

export const temarioRepository = {
  async videoVistaPrevia(idLeccion: number): Promise<{ leccionId: number; youtubeVideoId: string } | null> {
    const { rows } = await consultar<{ leccionId: number; youtubeVideoId: string }>(
      `SELECT l.id_leccion AS "leccionId", l.youtube_video_id AS "youtubeVideoId"
         FROM leccion l
         JOIN modulo m ON m.id_modulo = l.id_modulo
         JOIN curso c ON c.id_curso = m.id_curso
        WHERE l.id_leccion = $1 AND l.tipo = 'VIDEO' AND l.vista_previa = TRUE
          AND l.youtube_video_id IS NOT NULL AND c.estado = 'PUBLICADO'`,
      [idLeccion],
    );
    return rows[0] ?? null;
  },

  async archivosPdfDelCurso(idCurso: number): Promise<ArchivoCursoFila[]> {
    const { rows } = await consultar<ArchivoCursoFila>(
      `SELECT id_archivo AS id, ruta, tamano_bytes AS tamano
         FROM archivo
        WHERE id_curso = $1 AND tipo = 'PDF'`,
      [idCurso],
    );
    return rows;
  },

  /** Lectura sin bloqueo (pool): sirve para prevalidar los PDF en disco antes de abrir la transacción. */
  async idCursoDeModulo(idModulo: number): Promise<number | null> {
    const { rows } = await consultar<{ idCurso: number }>(
      `SELECT id_curso AS "idCurso" FROM modulo WHERE id_modulo = $1`,
      [idModulo],
    );
    return rows[0]?.idCurso ?? null;
  },

  /** Igual que `idCursoDeModulo`, a partir de una lección. */
  async idCursoDeLeccion(idLeccion: number): Promise<number | null> {
    const { rows } = await consultar<{ idCurso: number }>(
      `SELECT m.id_curso AS "idCurso"
         FROM leccion l
         JOIN modulo m ON m.id_modulo = l.id_modulo
        WHERE l.id_leccion = $1`,
      [idLeccion],
    );
    return rows[0]?.idCurso ?? null;
  },

  async contarModulos(
    cliente: PoolClient,
    idCurso: number,
  ): Promise<number> {
    const { rows } = await cliente.query<{
      total: number;
    }>(
      `
        SELECT COUNT(*)::int AS total
        FROM modulo
        WHERE id_curso = $1
      `,
      [idCurso],
    );

    return rows[0]?.total ?? 0;
  },

  async ordenModuloOcupado(
    cliente: PoolClient,
    idCurso: number,
    orden: number,
    idModuloExcluir: number | null = null,
  ): Promise<boolean> {
    const { rows } = await cliente.query(
      `
        SELECT 1
        FROM modulo
        WHERE id_curso = $1
          AND orden = $2
          AND ($3::integer IS NULL OR id_modulo <> $3)
      `,
      [idCurso, orden, idModuloExcluir],
    );

    return rows.length > 0;
  },

  async crearModulo(
    cliente: PoolClient,
    idCurso: number,
    datos: {
      titulo: string;
      orden: number;
    },
  ): Promise<number> {
    const { rows } = await cliente.query<{
      id: number;
    }>(
      `
        INSERT INTO modulo (
          id_curso,
          titulo,
          orden
        )
        VALUES ($1, $2, $3)
        RETURNING id_modulo AS id
      `,
      [
        idCurso,
        datos.titulo,
        datos.orden,
      ],
    );

    return rows[0]!.id;
  },

  async buscarModulo(
    cliente: PoolClient,
    idModulo: number,
  ): Promise<{ idCurso: number } | null> {
    const { rows } = await cliente.query<{
      idCurso: number;
    }>(
      `SELECT id_curso AS "idCurso"
       FROM modulo
       WHERE id_modulo = $1`,
      [idModulo],
    );

    return rows[0] ?? null;
  },

  async actualizarModulo(
    cliente: PoolClient,
    idModulo: number,
    idCurso: number,
    titulo: string,
    orden: number,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        UPDATE modulo
        SET titulo = $3,
            orden = $4
        WHERE id_modulo = $1
          AND id_curso = $2
      `,
      [idModulo, idCurso, titulo, orden],
    );

    return resultado.rowCount === 1;
  },

  async pdfDeModulo(
    cliente: PoolClient,
    idModulo: number,
  ): Promise<number[]> {
    const { rows } = await cliente.query<{
      id: number;
    }>(
      `
        SELECT DISTINCT id
        FROM (
          SELECT a.id_archivo AS id
          FROM leccion l
          JOIN archivo a
            ON a.id_archivo = l.id_archivo
          WHERE l.id_modulo = $1
            AND a.tipo = 'PDF'

          UNION

          SELECT a.id_archivo AS id
          FROM leccion l
          JOIN recurso_adjunto ra
            ON ra.id_leccion = l.id_leccion
          JOIN archivo a
            ON a.id_archivo = ra.id_archivo
          WHERE l.id_modulo = $1
            AND a.tipo = 'PDF'
        ) archivos
      `,
      [idModulo],
    );

    return rows.map(fila => fila.id);
  },

  async eliminarModulo(
    cliente: PoolClient,
    idModulo: number,
    idCurso: number,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        DELETE FROM modulo
        WHERE id_modulo = $1
          AND id_curso = $2
      `,
      [idModulo, idCurso],
    );

    return resultado.rowCount === 1;
  },

  async contarLecciones(
    cliente: PoolClient,
    idModulo: number,
  ): Promise<number> {
    const { rows } = await cliente.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM leccion
       WHERE id_modulo = $1`,
      [idModulo],
    );

    return rows[0]?.total ?? 0;
  },

  async ordenLeccionOcupado(
    cliente: PoolClient,
    idModulo: number,
    orden: number,
    idLeccionExcluir: number | null = null,
  ): Promise<boolean> {
    const { rows } = await cliente.query(
      `
        SELECT 1
        FROM leccion
        WHERE id_modulo = $1
          AND orden = $2
          AND ($3::integer IS NULL OR id_leccion <> $3)
      `,
      [idModulo, orden, idLeccionExcluir],
    );

    return rows.length > 0;
  },

  async crearLeccion(
    cliente: PoolClient,
    idModulo: number,
    datos: DatosLeccion,
    youtubeVideoId: string | null,
  ): Promise<number> {
    const { rows } = await cliente.query<{ id: number }>(
      `INSERT INTO leccion (
         id_modulo, titulo, orden, tipo, youtube_video_id, vista_previa
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_leccion AS id`,
      [idModulo, datos.titulo, datos.orden, datos.tipo, youtubeVideoId,
        datos.tipo === 'VIDEO' ? datos.vistaPrevia : false],
    );

    return rows[0]!.id;
  },

  async buscarLeccionParaEditar(
    cliente: PoolClient,
    idLeccion: number,
  ): Promise<{
    idCurso: number;
    idModulo: number;
    tipo: string;
  } | null> {
    const { rows } = await cliente.query<{
      idCurso: number;
      idModulo: number;
      tipo: string;
    }>(
      `
        SELECT
          m.id_curso AS "idCurso",
          l.id_modulo AS "idModulo",
          l.tipo
        FROM leccion l
        JOIN modulo m
          ON m.id_modulo = l.id_modulo
        WHERE l.id_leccion = $1
      `,
      [idLeccion],
    );

    return rows[0] ?? null;
  },

  async actualizarLeccion(
    cliente: PoolClient,
    idLeccion: number,
    idModulo: number,
    datos: DatosLeccion,
    youtubeVideoId: string | null,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        UPDATE leccion
        SET titulo = $3,
            orden = $4,
            youtube_video_id = $6,
            vista_previa = $7
        WHERE id_leccion = $1
          AND id_modulo = $2
          AND tipo = $5
      `,
      [
        idLeccion,
        idModulo,
        datos.titulo,
        datos.orden,
        datos.tipo,
        youtubeVideoId,
        datos.tipo === 'VIDEO' ? datos.vistaPrevia : false,
      ],
    );

    return resultado.rowCount === 1;
  },

  async pdfDeLeccion(
    cliente: PoolClient,
    idLeccion: number,
  ): Promise<number[]> {
    const { rows } = await cliente.query<{
      id: number;
    }>(
      `
        SELECT id
        FROM (
          SELECT a.id_archivo AS id
          FROM leccion l
          JOIN archivo a
            ON a.id_archivo = l.id_archivo
          WHERE l.id_leccion = $1
            AND a.tipo = 'PDF'

          UNION

          SELECT a.id_archivo AS id
          FROM recurso_adjunto ra
          JOIN archivo a
            ON a.id_archivo = ra.id_archivo
          WHERE ra.id_leccion = $1
            AND a.tipo = 'PDF'
        ) archivos
      `,
      [idLeccion],
    );

    return rows.map(fila => fila.id);
  },

  async eliminarLeccion(
    cliente: PoolClient,
    idLeccion: number,
    idModulo: number,
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        DELETE FROM leccion
        WHERE id_leccion = $1
          AND id_modulo = $2
      `,
      [idLeccion, idModulo],
    );

    return resultado.rowCount === 1;
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
          l.youtube_video_id AS "youtubeVideoId",
          l.vista_previa AS "vistaPrevia",
          (SELECT count(*)::int
             FROM evaluacion e
             JOIN pregunta p ON p.id_evaluacion = e.id_evaluacion
            WHERE e.id_leccion = l.id_leccion) AS preguntas,

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
          AND l.tipo IN ('DOCUMENTO', 'VIDEO')
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
};
