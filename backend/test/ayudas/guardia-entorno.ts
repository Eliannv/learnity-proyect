// Lógica pura de la guarda de BD (sin efectos al importarla). La usa guardia-bd.ts.
// Sin excepciones: ni LEARNITY_PRUEBA_LOCAL ni ninguna otra variable habilita la base Learnity.

export function nombreBaseValido(nombre: string | undefined | null): boolean {
  if (!nombre) return false;
  const n = nombre.toLowerCase();
  return n !== 'learnity' && n.endsWith('_test') && n.length > '_test'.length;
}

/** Devuelve un mensaje de error o null si el entorno es apto para pruebas. */
export function comprobarEntorno(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string | null {
  if (env['NODE_ENV'] !== 'test') {
    return `NODE_ENV debe ser "test" (es ${JSON.stringify(env['NODE_ENV'] ?? null)}).`;
  }
  const base = env['DB_NAME'];
  if (!base) return 'DB_NAME no está definido en process.env.';
  if (!nombreBaseValido(base)) {
    return `DB_NAME debe terminar en "_test" y no ser Learnity (es ${JSON.stringify(base)}). No hay excepciones.`;
  }
  return null;
}

/** Defensa frente a una conexión real distinta de la esperada: consulta current_database(). */
export async function verificarBaseConectada(pool: { query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }> }): Promise<string> {
  const { rows } = await pool.query('SELECT current_database() AS base');
  const base = String(rows[0]?.['base'] ?? '');
  if (!nombreBaseValido(base)) {
    throw new Error(`La conexión real apunta a ${JSON.stringify(base)}; las pruebas solo corren en bases *_test.`);
  }
  return base;
}
