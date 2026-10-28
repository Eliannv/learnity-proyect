import type { PoolClient } from 'pg';
import { consultar } from '../../shared/database/pool.js';
import type { CategoriaAdmin } from './categorias.modelo.js';

// Lee la tabla `categoria` (también las inactivas), nunca la vista pública del catálogo (ADR-012 §6).
const CAMPOS = `
  cat.id_categoria AS id, cat.nombre, cat.descripcion, cat.activa,
  (SELECT count(*)::int FROM curso c WHERE c.id_categoria = cat.id_categoria) AS cursos,
  (SELECT count(*)::int FROM curso c WHERE c.id_categoria = cat.id_categoria AND c.estado = 'PUBLICADO')
    AS "cursosPublicados"`;

export const categoriasRepository = {
  async listar(): Promise<CategoriaAdmin[]> {
    const { rows } = await consultar<CategoriaAdmin>(
      `SELECT ${CAMPOS} FROM categoria cat ORDER BY cat.nombre ASC, cat.id_categoria ASC`,
    );
    return rows;
  },

  async buscar(cliente: PoolClient, id: number): Promise<CategoriaAdmin | null> {
    const { rows } = await cliente.query<CategoriaAdmin>(
      `SELECT ${CAMPOS} FROM categoria cat WHERE cat.id_categoria = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  /** Otra categoría con el mismo nombre, sin distinguir mayúsculas. */
  async nombreOcupado(cliente: PoolClient, nombre: string, excluir: number | null = null): Promise<boolean> {
    const { rows } = await cliente.query(
      `SELECT 1 FROM categoria WHERE lower(nombre) = lower($1) AND ($2::int IS NULL OR id_categoria <> $2)`,
      [nombre, excluir],
    );
    return rows.length > 0;
  },

  async crear(cliente: PoolClient, nombre: string, descripcion: string | null, idPersona: number): Promise<number> {
    const { rows } = await cliente.query<{ id: number }>(
      `INSERT INTO categoria (nombre, descripcion, creada_por) VALUES ($1, $2, $3)
       RETURNING id_categoria AS id`,
      [nombre, descripcion, idPersona],
    );
    return rows[0]!.id;
  },

  async actualizar(
    cliente: PoolClient, id: number, nombre: string, descripcion: string | null, activa: boolean,
  ): Promise<boolean> {
    const r = await cliente.query(
      'UPDATE categoria SET nombre = $2, descripcion = $3, activa = $4 WHERE id_categoria = $1',
      [id, nombre, descripcion, activa],
    );
    return r.rowCount === 1;
  },
};
