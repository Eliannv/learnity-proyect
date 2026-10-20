// Pool de fixtures: sirve para PREPARAR y LIMPIAR datos (INSERT/DELETE directos) sin pasar por la app.
// La app bajo prueba usa su propio pool (src/shared/database/pool.ts) con learnity_app.
//
// BD-019b (opción 3): learnity_app tiene concedido learnity_pruebas WITH INHERIT FALSE, SET TRUE.
// Cuándo se activa SET ROLE:
//   - Si el rol learnity_pruebas EXISTE en el clúster, cada operación del pool de fixtures hace
//     SET ROLE learnity_pruebas y RESET ROLE al terminar. Si el rol existe pero SET ROLE falla,
//     se lanza el error (no se degrada en silencio: sería ocultar un permiso que falta).
//   - Si NO existe (hoy learnity_test está en la línea base, sin migraciones), se usa la conexión
//     normal de learnity_app.
// Importa antes ./guardia-bd.js en la suite; aquí solo se verifica la base conectada.
import pg from 'pg';
import { verificarBaseConectada } from './guardia-entorno.js';

export const ROL_PRUEBAS = 'learnity_pruebas';

export interface Fixtures {
  /** true si las operaciones corren con SET ROLE learnity_pruebas. */
  readonly conRol: boolean;
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, parametros?: unknown[]): Promise<pg.QueryResult<T>>;
  transaccion<T>(trabajo: (cliente: pg.PoolClient) => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
}

export async function crearFixtures(): Promise<Fixtures> {
  const env = process.env;
  const pool = new pg.Pool({
    host: env['DB_HOST'],
    port: Number(env['DB_PORT'] ?? 5432),
    database: env['DB_NAME'],
    user: env['DB_USER'],
    password: env['DB_PASSWORD'],
    ssl: env['DB_SSL'] === 'true' ? { rejectUnauthorized: true } : undefined,
    max: 3,
  });
  pool.on('error', () => { /* conexión inactiva caída: se reabre en la siguiente operación */ });
  await verificarBaseConectada(pool);

  const { rows } = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROL_PRUEBAS]);
  const conRol = rows.length > 0;

  async function conCliente<T>(trabajo: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const cliente = await pool.connect();
    let roto = false;
    try {
      if (conRol) await cliente.query(`SET ROLE ${ROL_PRUEBAS}`);
      return await trabajo(cliente);
    } catch (e) {
      roto = true;
      throw e;
    } finally {
      try { if (conRol) await cliente.query('RESET ROLE'); } catch { roto = true; }
      cliente.release(roto ? true : undefined);
    }
  }

  return {
    conRol,
    query: (sql, parametros = []) => conCliente((c) => c.query(sql, parametros)) as never,
    async transaccion(trabajo) {
      return conCliente(async (c) => {
        await c.query('BEGIN');
        try {
          const r = await trabajo(c);
          await c.query('COMMIT');
          return r;
        } catch (e) {
          await c.query('ROLLBACK').catch(() => undefined);
          throw e;
        }
      });
    },
    cerrar: () => pool.end(),
  };
}
