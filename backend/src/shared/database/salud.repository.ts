import { pool } from './pool.js';

/** SQL de la comprobación de arranque (antes inline en server.ts). Sin parámetros ni datos de usuario. */
export interface EstadoEsquema {
  base: string;
  usuario: string;
  /** Nombre de la tabla `sesion` si existe, o null si falta la migración 015. */
  sesiones: string | null;
}

export async function verificarEsquema(): Promise<EstadoEsquema> {
  const { rows } = await pool.query<EstadoEsquema>(
    `SELECT current_database() AS base,
            current_user AS usuario,
            to_regclass('public.sesion')::text AS sesiones`,
  );
  return rows[0]!;
}

/** Comprobación mínima de que PostgreSQL responde (`/api/salud`). No devuelve ningún dato de la base. */
export async function comprobarConexion(): Promise<void> {
  await pool.query('SELECT 1');
}
