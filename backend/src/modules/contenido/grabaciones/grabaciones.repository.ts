import type { PoolClient } from 'pg';
import { TAMANO_PARTE } from './grabaciones.formato.js';

export interface OrigenGrabacion {
  id: string;
  tamano: number;
  bucket: string | null;
  clave: string;
}
interface Grabacion extends OrigenGrabacion {
  curso: number;
  persona: number;
  lista: boolean;
  siguiente: number;
}
export const grabacionesRepository = {
  async cursoEditable(db: PoolClient, curso: number, persona: number) {
    const r = await db.query(
      `SELECT 1 FROM curso c JOIN docente d USING(id_docente)
      WHERE c.id_curso=$1 AND d.id_persona=$2 AND d.estado='ACTIVO' AND c.estado IN ('BORRADOR','RECHAZADO','PUBLICADO')
      FOR SHARE OF c,d`,
      [curso, persona],
    );
    return r.rowCount === 1;
  },
  async depurar(db: PoolClient, curso: number | null) {
    await db.query(
      `DELETE FROM grabacion g WHERE ($1::integer IS NULL OR id_curso=$1) AND creada_en < now()-interval '24 hours'
      AND NOT EXISTS (SELECT FROM leccion l WHERE l.id_grabacion=g.id)`,
      [curso],
    );
  },
  async iniciar(
    db: PoolClient,
    id: string,
    curso: number,
    persona: number,
    tamano: number,
    bucket: string | null,
  ) {
    await db.query(
      'INSERT INTO grabacion(id,id_curso,id_persona,tamano,bucket) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [id, curso, persona, tamano, bucket],
    );
  },
  async cursoDeCarga(db: PoolClient, id: string, persona: number) {
    const r = await db.query<{ curso: number }>(
      'SELECT id_curso AS curso FROM grabacion WHERE id=$1 AND id_persona=$2',
      [id, persona],
    );
    return r.rows[0]?.curso;
  },
  async buscar(db: PoolClient, id: string, persona: number) {
    const r = await db.query<Grabacion>(
      `SELECT g.id, g.id_curso AS curso, g.id_persona AS persona, g.tamano, g.lista,g.bucket,g.clave,
      (SELECT count(*)::int FROM grabacion_parte p WHERE p.id_grabacion=g.id) AS siguiente
      FROM grabacion g WHERE g.id=$1 AND g.id_persona=$2 AND g.creada_en > now()-interval '24 hours' FOR UPDATE OF g`,
      [id, persona],
    );
    return r.rows[0];
  },
  async huella(db: PoolClient, id: string, numero: number) {
    const r = await db.query<{ huella: Buffer }>(
      'SELECT huella FROM grabacion_parte WHERE id_grabacion=$1 AND numero=$2',
      [id, numero],
    );
    return r.rows[0]?.huella;
  },
  async parte(db: PoolClient, id: string, numero: number, bytes: Buffer | null, huella: Buffer) {
    await db.query('INSERT INTO grabacion_parte(id_grabacion,numero,bytes,huella) VALUES($1,$2,$3,$4)', [
      id,
      numero,
      bytes,
      huella,
    ]);
  },
  async retiradas(db: PoolClient) {
    return (
      await db.query<{ clave: string; bucket: string; partes: number }>(
        'SELECT clave,bucket,partes FROM grabacion_retirada ORDER BY clave LIMIT 25',
      )
    ).rows;
  },
  async confirmarRetirada(db: PoolClient, clave: string) {
    await db.query('DELETE FROM grabacion_retirada WHERE clave=$1', [clave]);
  },
  async confirmar(db: PoolClient, id: string) {
    await db.query('UPDATE grabacion SET lista=true WHERE id=$1', [id]);
  },
  async leer(db: PoolClient, id: string, inicio: number, longitud: number): Promise<Buffer> {
    const fin = inicio + longitud - 1;
    const r = await db.query<{ datos: Buffer }>(
      `SELECT substring(bytes FROM greatest(0,$2-numero*$4)+1
      FOR least(octet_length(bytes),$3-numero*$4+1)-greatest(0,$2-numero*$4)) AS datos
      FROM grabacion_parte WHERE id_grabacion=$1 AND numero BETWEEN $2::integer/$4::integer AND $3::integer/$4 ORDER BY numero`,
      [id, inicio, fin, TAMANO_PARTE],
    );
    return Buffer.concat(r.rows.map((p) => p.datos));
  },
  async deLeccion(
    db: PoolClient,
    leccion: number,
    persona: number,
    docente: boolean,
    admin: boolean,
    estudiante: boolean,
  ) {
    const r = await db.query<OrigenGrabacion>(
      `SELECT g.id,g.tamano,g.bucket,g.clave FROM leccion l
      JOIN grabacion g ON g.id=l.id_grabacion AND g.lista JOIN curso c ON c.id_curso=g.id_curso
      JOIN docente d ON d.id_docente=c.id_docente
      WHERE l.id_leccion=$1 AND ($4::boolean OR ($3 AND d.id_persona=$2 AND d.estado='ACTIVO')
        OR ($5 AND c.estado='PUBLICADO' AND EXISTS (
          SELECT FROM leccion_asignada a JOIN inscripcion i USING(id_inscripcion)
          WHERE a.id_leccion=l.id_leccion AND i.id_persona=$2)))`,
      [leccion, persona, docente, admin, estudiante],
    );
    return r.rows[0];
  },
};
