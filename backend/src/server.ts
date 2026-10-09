import { crearApp } from './app.js';
import { env } from './shared/config/env.js';
import { pool } from './shared/database/pool.js';

const app = crearApp();

const servidor = app.listen(env.PORT, async () => {
  console.log(`API de Learnity en http://localhost:${env.PORT}/api  ·  documentación: /api/docs`);
  try {
    const { rows } = await pool.query('SELECT current_database() AS base, current_user AS usuario');
    console.log(`PostgreSQL conectado: base "${rows[0].base}" con la cuenta "${rows[0].usuario}".`);
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL. Revisa DB_* en tu .env:', (error as Error).message);
  }
});

// Cierre ordenado (Ctrl+C)
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => {
    servidor.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
}
