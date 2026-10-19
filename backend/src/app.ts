import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './shared/config/env.js';
import { consultar } from './shared/database/pool.js';
import { registrarVerificadorSesion } from './shared/auth/middlewares.js';
import { correlacion, ENCABEZADO_ID_PETICION } from './shared/http/correlacion.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/http/manejador-errores.js';
import { openApi } from './shared/http/openapi.js';
import { identidadRoutes } from './modules/identidad/identidad.routes.js';
import { identidadService } from './modules/identidad/identidad.service.js';
import { cursosRoutes } from './modules/cursos/cursos.routes.js';
import { contenidoRoutes } from './modules/contenido/contenido.routes.js';
import { aprendizajeRoutes } from './modules/aprendizaje/aprendizaje.routes.js';
import { evaluacionesRoutes } from './modules/evaluaciones/evaluaciones.routes.js';
import { administracionRoutes } from './modules/administracion/administracion.routes.js';

export function crearApp() {
  const app = express();

  // Detrás de un proxy inverso, req.ip debe ser la IP del cliente (límite por IP y auditoría).
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(correlacion);
  app.use(helmet());
  app.use(cors({ origin: env.ORIGENES, credentials: true, exposedHeaders: [ENCABEZADO_ID_PETICION] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // `autenticar` (shared) pregunta a Identidad si la sesión del access token sigue vigente.
  registrarVerificadorSesion((usuario) => identidadService.sesionVigente(usuario));

  // Comprobación rápida: ¿el servidor responde y llega a PostgreSQL?
  app.get('/api/salud', async (_req, res) => {
    const { rows } = await consultar<{ base: string; usuario: string; roles: number }>(
      'SELECT current_database() AS base, current_user AS usuario, (SELECT count(*)::int FROM rol) AS roles',
    );
    res.json({ estado: 'ok', baseDeDatos: rows[0] });
  });

  // Documentación de la API (Swagger)
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi));

  // Módulos del monolito. Cada uno solo expone sus rutas; el resto queda dentro del módulo.
  const api = express.Router();
  api.use(identidadRoutes);
  api.use(cursosRoutes);
  api.use(contenidoRoutes);
  api.use(aprendizajeRoutes);
  api.use(evaluacionesRoutes);
  api.use(administracionRoutes);
  app.use('/api', api);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}
