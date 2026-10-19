import pg from 'pg';
import { env } from '../config/env.js';
import { registrarEvento } from '../log/registro.js';

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
  registrarEvento('bd.conexion_inactiva_fallida', { mensaje: error.message }, 'error');
});

/**
 * Lo mínimo que necesita un repositorio para ejecutar SQL: el pool (lecturas sueltas) o el cliente
 * de una transacción. Los repositorios que escriben reciben el cliente de `enTransaccion`.
 */
export type Ejecutor = Pick<pg.PoolClient, 'query'>;

/** Ejecuta una consulta parametrizada. Usa siempre $1, $2… nunca concatenes valores en el SQL. */
export function consultar<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, parametros: unknown[] = []) {
  return pool.query<T>(sql, parametros);
}

export interface OpcionesTransaccion {
  /**
   * `id_persona` de quien origina la escritura. La auditoría de base de datos (migración 020) lo lee de
   * `current_setting('learnity.id_persona', true)`. Sin actor, la fila de auditoría queda sin autor.
   */
  actor?: number | null;
}

/** Fija el actor solo para esta transacción (`is_local = true`): al terminar vuelve a quedar vacío. */
async function fijarActor(cliente: pg.PoolClient, actor: number): Promise<void> {
  if (!Number.isSafeInteger(actor) || actor < 1) {
    throw new TypeError('El actor de la transacción debe ser un id_persona entero positivo.');
  }
  await cliente.query("SELECT set_config('learnity.id_persona', $1, true)", [String(actor)]);
}

/**
 * Ejecuta varias consultas en una transacción: si una falla, se deshacen todas.
 * Ejemplo: el registro crea persona + usuario + rol ESTUDIANTE dentro de una misma transacción.
 *
 * Si la conexión murió, el ROLLBACK también falla: se registra, pero el error que se lanza es siempre el
 * original, y el cliente se libera con ese fallo para que el pool lo descarte en lugar de reutilizarlo.
 */
export async function enTransaccion<T>(
  trabajo: (cliente: pg.PoolClient) => Promise<T>,
  opciones: OpcionesTransaccion = {},
): Promise<T> {
  const cliente = await pool.connect();
  let clienteRoto: Error | undefined;
  try {
    await cliente.query('BEGIN');
    if (opciones.actor != null) await fijarActor(cliente, opciones.actor);
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await cliente.query('ROLLBACK');
    } catch (errorRollback) {
      clienteRoto = errorRollback instanceof Error ? errorRollback : new Error('Fallo el ROLLBACK.');
      registrarEvento('bd.rollback_fallido', { mensaje: clienteRoto.message }, 'error');
    }
    throw error;
  } finally {
    cliente.release(clienteRoto);
  }
}
