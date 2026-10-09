import pg from 'pg';
import { env } from '../config/env.js';

// Un solo pool de conexiones para toda la aplicación.
// Se conecta con learnity_app: puede leer y modificar datos, pero no cambiar la estructura.
export const pool = new pg.Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión de PostgreSQL:', error.message);
});

/** Ejecuta una consulta parametrizada. Usa siempre $1, $2… nunca concatenes valores en el SQL. */
export function consultar<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, parametros: unknown[] = []) {
  return pool.query<T>(sql, parametros);
}

/**
 * Ejecuta varias consultas en una transacción: si una falla, se deshacen todas.
 * Ejemplo: el registro crea persona + usuario + rol ESTUDIANTE dentro de una misma transacción.
 */
export async function enTransaccion<T>(trabajo: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
