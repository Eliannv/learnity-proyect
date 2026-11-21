import type { PoolClient } from 'pg';
import type { DatosGrupo } from './grupos.esquemas.js';

export const gruposRepository = {
  async esPropietario(db: PoolClient, curso: number, persona: number, escribir: boolean) {
    const r = await db.query(
      `SELECT 1 FROM curso c JOIN docente d USING(id_docente)
      WHERE c.id_curso=$1 AND d.id_persona=$2 AND d.estado='ACTIVO'
      ${escribir ? 'FOR UPDATE OF c' : 'FOR SHARE OF c'}`,
      [curso, persona],
    );
    return r.rowCount === 1;
  },
  async listar(db: PoolClient, curso: number) {
    const grupos = await db.query(
      `SELECT g.id_grupo AS id,g.nombre,g.revision,
      ARRAY(SELECT gm.id_inscripcion FROM grupo_miembro gm WHERE gm.id_grupo=g.id_grupo ORDER BY gm.id_inscripcion) AS miembros
      FROM grupo_curso g WHERE g.id_curso=$1 ORDER BY lower(g.nombre),g.id_grupo`,
      [curso],
    );
    const inscritos = await db.query(
      `SELECT i.id_inscripcion AS id, concat_ws(' ',p.nombres,p.apellidos) AS nombre
      FROM inscripcion i JOIN persona p USING(id_persona) WHERE i.id_curso=$1 ORDER BY nombre,i.id_inscripcion`,
      [curso],
    );
    return { grupos: grupos.rows, inscritos: inscritos.rows };
  },
  async guardar(db: PoolClient, curso: number, id: number | null, datos: DatosGrupo, revision?: number) {
    const r =
      id === null
        ? await db.query('INSERT INTO grupo_curso(id_curso,nombre) VALUES ($1,$2) RETURNING id_grupo', [
            curso,
            datos.nombre,
          ])
        : await db.query(
            'UPDATE grupo_curso SET nombre=$2,revision=revision+1 WHERE id_curso=$1 AND id_grupo=$3 AND revision=$4 RETURNING id_grupo',
            [curso, datos.nombre, id, revision],
          );
    if (!r.rowCount) return false;
    const grupo = r.rows[0].id_grupo;
    await db.query('DELETE FROM grupo_miembro WHERE id_grupo=$1 AND NOT (id_inscripcion=ANY($2::int[]))', [
      grupo,
      datos.miembros,
    ]);
    await db.query(
      `INSERT INTO grupo_miembro(id_grupo,id_curso,id_inscripcion)
      SELECT $1,$2,unnest($3::int[]) ON CONFLICT DO NOTHING`,
      [grupo, curso, datos.miembros],
    );
    await db.query('SELECT recalcular_avance_curso($1)', [curso]);
    return true;
  },
  async borrar(db: PoolClient, curso: number, grupo: number) {
    const usado = await db.query(
      'SELECT 1 FROM leccion WHERE id_grupo=$1 AND id_curso_contenido=$2 LIMIT 1',
      [grupo, curso],
    );
    if (usado.rowCount) return 'USADO';
    const r = await db.query('DELETE FROM grupo_curso WHERE id_curso=$1 AND id_grupo=$2', [curso, grupo]);
    return r.rowCount ? 'BORRADO' : 'AUSENTE';
  },
};
