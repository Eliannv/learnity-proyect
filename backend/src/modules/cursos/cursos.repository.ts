import { consultar } from '../../shared/database/pool.js';

export type NivelCurso = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
export type OrdenCatalogo = 'recientes' | 'populares' | 'az';

export interface FiltrosPublicos {
  q?: string;
  categorias: string[];
  niveles: NivelCurso[];
  orden: OrdenCatalogo;
  pagina: number;
  limite: number;
}

interface CategoriaFila { id: number; nombre: string }
interface CursoFila {
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
interface LeccionFila {
  moduloId: number;
  moduloOrden: number;
  moduloTitulo: string;
  id: number | null;
  orden: number | null;
  titulo: string | null;
  tipo: 'VIDEO' | 'DOCUMENTO' | 'EVALUACION' | null;
  segundos: number | null;
}

// Solo se interpolan condiciones y órdenes elegidos aquí; los datos del cliente
// siempre se envían como parámetros de PostgreSQL.
function consultaFiltrada(f: FiltrosPublicos) {
  const valores: unknown[] = [];
  const condiciones = ["c.estado = 'PUBLICADO'"];
  if (f.q) {
    valores.push(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
    condiciones.push(`(c.titulo ILIKE $${valores.length} ESCAPE '\\' OR c.subtitulo ILIKE $${valores.length} ESCAPE '\\' OR c.descripcion ILIKE $${valores.length} ESCAPE '\\')`);
  }
  if (f.categorias.length) {
    valores.push(f.categorias);
    condiciones.push(`cat.nombre = ANY($${valores.length}::text[])`);
  }
  if (f.niveles.length) {
    valores.push(f.niveles);
    condiciones.push(`c.nivel = ANY($${valores.length}::text[])`);
  }
  return {
    desde: 'FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria',
    donde: `WHERE ${condiciones.join(' AND ')}`,
    valores,
  };
}

const camposCurso = `
  c.id_curso AS id, c.titulo, c.subtitulo, COALESCE(c.descripcion, '') AS descripcion,
  cat.id_categoria AS "categoriaId", cat.nombre AS "categoriaNombre",
  concat_ws(' ', p.nombres, p.apellidos) AS docente, p.biografia AS "docenteBio",
  c.nivel, c.portada_url AS "portadaUrl", c.objetivos, c.requisitos,
  COALESCE(c.publicado_en, c.creado_en) AS "publicadoEn",
  COALESCE(contenido.modulos, 0)::int AS modulos,
  COALESCE(contenido.lecciones, 0)::int AS lecciones,
  COALESCE(contenido.segundos, 0)::int AS segundos`;

const unirContenido = `
  JOIN docente d ON d.id_docente = c.id_docente
  JOIN persona p ON p.id_persona = d.id_persona
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT m.id_modulo)::int AS modulos,
           COUNT(l.id_leccion)::int AS lecciones,
           COALESCE(SUM(a.duracion_seg), 0)::int AS segundos
    FROM modulo m
    LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
    LEFT JOIN archivo a ON a.id_archivo = l.id_archivo
    WHERE m.id_curso = c.id_curso
  ) contenido ON TRUE`;

export const cursosRepository = {
  async categoriasPublicas(): Promise<CategoriaFila[]> {
    const { rows } = await consultar<CategoriaFila>(
      'SELECT id_categoria AS id, nombre FROM categoria WHERE activa = TRUE ORDER BY nombre ASC, id_categoria ASC',
    );
    return rows;
  },

  async catalogoPublico(f: FiltrosPublicos): Promise<{ filas: CursoFila[]; total: number }> {
    const { desde, donde, valores } = consultaFiltrada(f);
    const conteo = await consultar<{ total: number }>(`SELECT COUNT(*)::int AS total ${desde} ${donde}`, valores);
    const ordenes: Record<OrdenCatalogo, string> = {
      recientes: 'c.publicado_en DESC NULLS LAST, c.id_curso DESC',
      populares: 'popular.inscripciones DESC, c.id_curso DESC',
      az: 'c.titulo ASC, c.id_curso ASC',
    };
    const popular = f.orden === 'populares'
      ? `LEFT JOIN LATERAL (SELECT COUNT(*)::int AS inscripciones FROM inscripcion i WHERE i.id_curso = c.id_curso) popular ON TRUE`
      : '';
    const ordenFinal = f.orden === 'populares' ? 'x.inscripciones DESC, c.id_curso DESC' : ordenes[f.orden];
    const { rows } = await consultar<CursoFila>(
      `WITH paginados AS (
         SELECT c.id_curso${f.orden === 'populares' ? ', popular.inscripciones' : ''}
         ${desde} ${popular} ${donde}
         ORDER BY ${ordenes[f.orden]} LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}
       )
       SELECT ${camposCurso}
       FROM paginados x
       JOIN curso c ON c.id_curso = x.id_curso
       JOIN categoria cat ON cat.id_categoria = c.id_categoria
       ${unirContenido}
       ORDER BY ${ordenFinal}`,
      [...valores, f.limite, (f.pagina - 1) * f.limite],
    );
    return { filas: rows, total: conteo.rows[0]?.total ?? 0 };
  },

  async detallePublico(id: number): Promise<CursoFila | null> {
    const { rows } = await consultar<CursoFila>(
      `SELECT ${camposCurso}
       FROM curso c
       JOIN categoria cat ON cat.id_categoria = c.id_categoria
       ${unirContenido}
       WHERE c.id_curso = $1 AND c.estado = 'PUBLICADO'`,
      [id],
    );
    return rows[0] ?? null;
  },

  async temarioPublico(id: number): Promise<LeccionFila[]> {
    const { rows } = await consultar<LeccionFila>(
      `SELECT m.id_modulo AS "moduloId", m.orden AS "moduloOrden", m.titulo AS "moduloTitulo",
              l.id_leccion AS id, l.orden, l.titulo, l.tipo, a.duracion_seg AS segundos
       FROM modulo m
       JOIN curso c ON c.id_curso = m.id_curso AND c.estado = 'PUBLICADO'
       LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
       LEFT JOIN archivo a ON a.id_archivo = l.id_archivo
       WHERE m.id_curso = $1
       ORDER BY m.orden, m.id_modulo, l.orden, l.id_leccion`,
      [id],
    );
    return rows;
  },
};

export type { CursoFila, LeccionFila };
