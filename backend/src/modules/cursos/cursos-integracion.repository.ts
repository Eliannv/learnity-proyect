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
          ) AS modulos
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
    datos: {
      titulo: string;
      orden: number;
      tipo: 'DOCUMENTO';
    },
  ): Promise<number> {
    const { rows } = await cliente.query<{ id: number }>(
      `INSERT INTO leccion (
         id_modulo, titulo, orden, tipo
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id_leccion AS id`,
      [idModulo, datos.titulo, datos.orden, datos.tipo],
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
    datos: {
      titulo: string;
      orden: number;
      tipo: 'DOCUMENTO';
    },
  ): Promise<boolean> {
    const resultado = await cliente.query(
      `
        UPDATE leccion
        SET titulo = $3,
            orden = $4
        WHERE id_leccion = $1
          AND id_modulo = $2
          AND tipo = 'DOCUMENTO'
      `,
      [
        idLeccion,
        idModulo,
        datos.titulo,
        datos.orden,
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