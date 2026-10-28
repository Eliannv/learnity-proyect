import { consultar } from '../../shared/database/pool.js';
import type {
  CalificacionCurso,
  CategoriaPublica,
  FiltrosPublicos,
  InstructorPublico,
  NivelCurso,
  OrdenCatalogo,
  TipoLeccionPublica,
} from './catalogo.modelo.js';

export interface CursoFila {
  id: number;
  titulo: string;
  subtitulo: string | null;
  descripcion: string;
  categoriaId: number;
  categoriaNombre: string;
  docente: string;
  docenteBio: string | null;
  nivel: NivelCurso;
  portadaUrl: string | null;
  objetivos: string[];
  requisitos: string[];
  modulos: number;
  lecciones: number;
  segundos: number;
  publicadoEn: Date;
}

export interface LeccionFila {
  moduloId: number;
  moduloOrden: number;
  moduloTitulo: string;
  id: number | null;
  orden: number | null;
  titulo: string | null;
  tipo: TipoLeccionPublica | null;
  segundos: number | null;
}

// Vistas creadas por la migración 026 (ADR-002): `catalogo_categoria`, `catalogo_curso` y `catalogo_temario`.
// Si la base de pruebas aún está en la línea base H0 (antes de aplicar 026 con `postgres`), se usa un CTE
// equivalente con las mismas columnas públicas (nunca `archivo.ruta` ni `id_archivo`).
const CTE_CATEGORIA = `
  WITH catalogo_categoria AS (
    SELECT cat.id_categoria AS id, cat.nombre
      FROM categoria cat
     WHERE cat.activa = TRUE
  )`;

const CTE_CURSO = `
  WITH catalogo_curso AS (
    SELECT c.id_curso                                  AS id,
           c.titulo,
           c.subtitulo,
           COALESCE(c.descripcion, '')                 AS descripcion,
           cat.id_categoria                            AS categoria_id,
           cat.nombre                                  AS categoria_nombre,
           concat_ws(' ', p.nombres, p.apellidos)      AS docente,
           p.biografia                                 AS docente_bio,
           c.nivel,
           c.portada_url,
           c.objetivos,
           c.requisitos,
           COALESCE(c.publicado_en, c.creado_en)       AS publicado_en,
           c.publicado_en                              AS publicado_en_orden,
           COALESCE(contenido.modulos, 0)::INT         AS modulos,
           COALESCE(contenido.lecciones, 0)::INT       AS lecciones,
           COALESCE(contenido.segundos, 0)::INT        AS segundos,
           COALESCE(popular.inscripciones, 0)::INT     AS inscripciones
      FROM curso c
      JOIN categoria cat ON cat.id_categoria = c.id_categoria
      JOIN docente d     ON d.id_docente = c.id_docente
      JOIN persona p     ON p.id_persona = d.id_persona
      LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT m.id_modulo)::INT      AS modulos,
                  COUNT(l.id_leccion)::INT              AS lecciones,
                  COALESCE(SUM(a.duracion_seg), 0)::INT AS segundos
             FROM modulo m
             LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
             LEFT JOIN archivo a ON a.id_archivo = l.id_archivo
            WHERE m.id_curso = c.id_curso
      ) contenido ON TRUE
      LEFT JOIN LATERAL (
           SELECT COUNT(*)::INT AS inscripciones
             FROM inscripcion i
            WHERE i.id_curso = c.id_curso
      ) popular ON TRUE
     WHERE c.estado = 'PUBLICADO'
  )`;

const CTE_TEMARIO = `
  WITH catalogo_temario AS (
    SELECT m.id_curso       AS curso_id,
           m.id_modulo      AS modulo_id,
           m.orden          AS modulo_orden,
           m.titulo         AS modulo_titulo,
           l.id_leccion     AS leccion_id,
           l.orden          AS leccion_orden,
           l.titulo         AS leccion_titulo,
           l.tipo           AS leccion_tipo,
           a.duracion_seg   AS segundos
      FROM modulo m
      JOIN curso c        ON c.id_curso = m.id_curso AND c.estado = 'PUBLICADO'
      LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
      LEFT JOIN archivo a ON a.id_archivo = l.id_archivo
  )`;

async function tieneVistasCatalogo(): Promise<boolean> {
  const { rows } = await consultar<{ ok: boolean }>(
    `SELECT to_regclass('public.catalogo_curso') IS NOT NULL AS ok`,
  );
  return rows[0]?.ok === true;
}

const CAMPOS_CURSO = `
  c.id, c.titulo, c.subtitulo, c.descripcion,
  c.categoria_id AS "categoriaId", c.categoria_nombre AS "categoriaNombre",
  c.docente, c.docente_bio AS "docenteBio",
  c.nivel, c.portada_url AS "portadaUrl", c.objetivos, c.requisitos,
  c.publicado_en AS "publicadoEn",
  c.modulos, c.lecciones, c.segundos`;

const ORDENES: Readonly<Record<OrdenCatalogo, string>> = {
  recientes: 'c.publicado_en_orden DESC NULLS LAST, c.id DESC',
  populares: 'c.inscripciones DESC, c.id DESC',
  az: 'c.titulo ASC, c.id ASC',
};

function consultaFiltrada(f: FiltrosPublicos) {
  const valores: unknown[] = [];
  const condiciones: string[] = [];
  if (f.q) {
    valores.push(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
    condiciones.push(
      `(c.titulo ILIKE $${valores.length} ESCAPE '\\' OR c.subtitulo ILIKE $${valores.length} ESCAPE '\\' OR c.descripcion ILIKE $${valores.length} ESCAPE '\\')`,
    );
  }
  if (f.categorias.length) {
    valores.push(f.categorias);
    condiciones.push(`c.categoria_nombre = ANY($${valores.length}::text[])`);
  }
  if (f.niveles.length) {
    valores.push(f.niveles);
    condiciones.push(`c.nivel = ANY($${valores.length}::text[])`);
  }
  return {
    donde: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    valores,
  };
}

export const catalogoRepository = {
  async categoriasPublicas(): Promise<CategoriaPublica[]> {
    const pre = (await tieneVistasCatalogo()) ? '' : CTE_CATEGORIA;
    const { rows } = await consultar<CategoriaPublica>(
      `${pre} SELECT id, nombre FROM catalogo_categoria ORDER BY nombre ASC, id ASC`,
    );
    return rows;
  },

  async catalogoPublico(f: FiltrosPublicos): Promise<{ filas: CursoFila[]; total: number }> {
    const pre = (await tieneVistasCatalogo()) ? '' : CTE_CURSO;
    const { donde, valores } = consultaFiltrada(f);
    const orden = ORDENES[f.orden];
    const conteo = await consultar<{ total: number }>(
      `${pre} SELECT COUNT(*)::int AS total FROM catalogo_curso c ${donde}`,
      valores,
    );
    const { rows } = await consultar<CursoFila>(
      `${pre}
       SELECT ${CAMPOS_CURSO}
         FROM catalogo_curso c
         ${donde}
        ORDER BY ${orden}
        LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, f.limite, (f.pagina - 1) * f.limite],
    );
    return { filas: rows, total: conteo.rows[0]?.total ?? 0 };
  },

  async detallePublico(id: number): Promise<CursoFila | null> {
    const pre = (await tieneVistasCatalogo()) ? '' : CTE_CURSO;
    const { rows } = await consultar<CursoFila>(
      `${pre} SELECT ${CAMPOS_CURSO} FROM catalogo_curso c WHERE c.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async temarioPublico(id: number): Promise<LeccionFila[]> {
    const pre = (await tieneVistasCatalogo()) ? '' : CTE_TEMARIO;
    const { rows } = await consultar<LeccionFila>(
      `${pre}
       SELECT modulo_id AS "moduloId", modulo_orden AS "moduloOrden", modulo_titulo AS "moduloTitulo",
              leccion_id AS id, leccion_orden AS orden, leccion_titulo AS titulo, leccion_tipo AS tipo, segundos
         FROM catalogo_temario
        WHERE curso_id = $1
        ORDER BY modulo_orden, modulo_id, leccion_orden, leccion_id`,
      [id],
    );
    return rows;
  },
  /** Ficha pública del docente de un curso publicado: lo que ayuda a decidir la inscripción. */
  async instructorDeCurso(id: number): Promise<InstructorPublico | null> {
    const { rows } = await consultar<InstructorPublico>(
      `SELECT concat_ws(' ', p.nombres, p.apellidos) AS nombre, d.especialidad,
              p.biografia, p.foto_url AS "fotoUrl",
              (SELECT count(*)::int FROM curso c2
                WHERE c2.id_docente = d.id_docente AND c2.estado = 'PUBLICADO') AS "cursosPublicados",
              (SELECT count(*)::int FROM inscripcion i JOIN curso c3 ON c3.id_curso = i.id_curso
                WHERE c3.id_docente = d.id_docente AND c3.estado = 'PUBLICADO') AS estudiantes
         FROM curso c
         JOIN docente d ON d.id_docente = c.id_docente
         JOIN persona p ON p.id_persona = d.id_persona
        WHERE c.id_curso = $1 AND c.estado = 'PUBLICADO'`,
      [id],
    );
    return rows[0] ?? null;
  },

  /** Promedio de estrellas (una reseña por inscripción) redondeado a un decimal. */
  async calificacion(id: number): Promise<CalificacionCurso> {
    const { rows } = await consultar<{ promedio: string | null; total: number }>(
      `SELECT round(avg(r.estrellas), 1) AS promedio, count(r.id_resena)::int AS total
         FROM resena r JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
        WHERE i.id_curso = $1`,
      [id],
    );
    const fila = rows[0]!;
    return { promedio: fila.promedio === null ? null : Number(fila.promedio), total: fila.total };
  },
};
