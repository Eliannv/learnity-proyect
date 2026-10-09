import { crearApp } from './app.js';
import { identidadService } from './modules/identidad/identidad.service.js';
import { env } from './shared/config/env.js';
import { pool } from './shared/database/pool.js';

const app = crearApp();

const servidor = app.listen(env.PORT, async () => {
  console.log(`API de Learnity en http://localhost:${env.PORT}/api  ·  documentación: /api/docs`);
  console.log(
    env.CORREO_TRANSPORTE === 'gmail'
      ? `Correo: Gmail API desde ${env.GMAIL_REMITENTE}.`
      : `Correo: buzón local de pruebas en "${env.BUZON_DIR}" (no se envían correos reales).`,
  );
  if (!env.COOKIE_SECURE) console.log('Cookies sin Secure (solo para desarrollo local por HTTP).');
  try {
    const { rows } = await pool.query<{ base: string; usuario: string; sesiones: string | null }>(
      `SELECT current_database() AS base, current_user AS usuario, to_regclass('public.sesion')::text AS sesiones`,
    );
    const { base, usuario, sesiones } = rows[0]!;
    console.log(`PostgreSQL conectado: base "${base}" con la cuenta "${usuario}".`);
    if (!sesiones) {
      console.error('Falta la tabla "sesion": aplica database/015_sesiones_y_recuperacion.sql en pgAdmin (ver README).');
    }
  } catch (error) {
    console.error('No se pudo conectar a PostgreSQL. Revisa DB_* en tu .env:', (error as Error).message);
  }
});

// Cierre ordenado (Ctrl+C): termina los correos en curso y cierra las conexiones.
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => {
    servidor.close(() => {
      void identidadService
        .esperarTareas()
        .then(() => pool.end())
        .then(() => process.exit(0));
    });
  });
}
