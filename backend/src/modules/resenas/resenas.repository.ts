import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { Resena, ResumenResenas } from './resenas.modelo.js';

// Una reseña pertenece a una inscripción (UNIQUE). Solo cuentan las de cursos publicados.

const CAMPOS = `
  r.id_resena AS id,
  trim(p.nombres || ' ' || COALESCE(left(p.apellidos, 1) || '.', '')) AS autor,
  p.foto_url AS "fotoUrl", r.estrellas, r.comentario,
  r.creado_en AS "creadoEn", r.actualizado_en AS "actualizadoEn"`;

interface FilaResena extends Omit<Resena, 'creadoEn' | 'actualizadoEn'> {
  creadoEn: Date;
  actualizadoEn: Date;
}

const publica = (f: FilaResena): Resena => ({
  ...f, creadoEn: f.creadoEn.toISOString(), actualizadoEn: f.actualizadoEn.toISOString(),
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
        WHERE i.id_curso = $1`,
      [idCurso],
    );
    const fila = rows[0]!;
    return {
      promedio: fila.promedio === null ? null : Number(fila.promedio),
      total: fila.total,
      distribucion: fila.distribucion,
    };
  },

  /** Primero las que tienen comentario y, dentro de ellas, las más recientes. */
  async pagina(idCurso: number, limite: number, offset: number): Promise<Resena[]> {
    const { rows } = await consultar<FilaResena>(
      `SELECT ${CAMPOS}
         FROM resena r
         JOIN inscripcion i ON i.id_inscripcion = r.id_inscripcion
         JOIN persona p ON p.id_persona = i.id_persona
        WHERE i.id_curso = $1
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
        WHERE r.id_inscripcion = $1`,
      [idInscripcion],
    );
    return rows[0] ? publica(rows[0]) : null;
  },

  /** Crea o reemplaza la reseña de la inscripción (UNIQUE id_inscripcion). */
  async guardar(cliente: PoolClient, idInscripcion: number, estrellas: number, comentario: string | null): Promise<void> {
    await cliente.query(
      `INSERT INTO resena (id_inscripcion, estrellas, comentario) VALUES ($1, $2, $3)
       ON CONFLICT (id_inscripcion) DO UPDATE SET estrellas = EXCLUDED.estrellas, comentario = EXCLUDED.comentario`,
      [idInscripcion, estrellas, comentario],
    );
  },

  async eliminar(cliente: PoolClient, idInscripcion: number): Promise<boolean> {
    const r = await cliente.query('DELETE FROM resena WHERE id_inscripcion = $1', [idInscripcion]);
    return r.rowCount === 1;
  },
};
