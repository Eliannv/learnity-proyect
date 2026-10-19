import {
  contenidoService,
} from './modules/contenido/contenido.service.js';

import { crearApp } from './app.js';

import {
  identidadService,
} from './modules/identidad/identidad.service.js';

import { env } from './shared/config/env.js';
import { pool } from './shared/database/pool.js';
import { verificarEsquema } from './shared/http/salud.repository.js';
import { registrarEvento } from './shared/log/registro.js';

const app = crearApp();

const servidor = app.listen(
  env.PORT,
  async () => {
    registrarEvento('servidor_iniciado', { puerto: env.PORT, url: `http://localhost:${env.PORT}/api` });
    registrarEvento(
      'correo_configurado',
      env.CORREO_TRANSPORTE === 'gmail'
        ? { transporte: 'gmail', remitente: env.GMAIL_REMITENTE }
        : { transporte: 'buzon', carpeta: env.BUZON_DIR },
    );
    if (!env.COOKIE_SECURE) {
      registrarEvento('cookies_sin_secure', { motivo: 'solo para desarrollo local por HTTP' }, 'aviso');
    }
    try {
      const { base, usuario, sesiones } = await verificarEsquema();
      registrarEvento('postgresql_conectado', { base, usuario });
      if (!sesiones) {
        registrarEvento(
          'falta_tabla_sesion',
          { ayuda: 'aplica database/015_sesiones_y_recuperacion.sql en pgAdmin (ver README)' },
          'error',
        );
      }
    } catch (error) {
      registrarEvento(
        'postgresql_sin_conexion',
        { ayuda: 'revisa DB_* en tu .env', mensaje: (error as Error).message },
        'error',
      );
    }
  },
);

// Reintenta las limpiezas pendientes al arrancar.
void contenidoService
  .limpiarPendientes()
  .catch(() => {
    registrarEvento(
      'limpieza_pdf_pendiente_fallida',
      { ayuda: 'revisa la migración 016 y ejecuta npm run archivos:limpiar' },
      'aviso',
    );
  });

// Cierre ordenado del servidor.
for (
  const senal of [
    'SIGINT',
    'SIGTERM',
  ] as const
) {
  process.on(senal, () => {
    servidor.close(() => {
      void identidadService
        .esperarTareas()
        .then(() => pool.end())
        .then(() => process.exit(0));
    });
  });
}