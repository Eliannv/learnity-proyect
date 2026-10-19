import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './shared/config/env.js';
import { registrarVerificadorSesion } from './shared/auth/middlewares.js';
import { correlacion, ENCABEZADO_ID_PETICION } from './shared/http/correlacion.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/http/manejador-errores.js';
import { comprobarConexion } from './shared/http/salud.repository.js';
import { registrarEvento } from './shared/log/registro.js';
import { openApi } from './shared/http/openapi.js';
import { identidadRoutes } from './modules/identidad/identidad.routes.js';
import { identidadService } from './modules/identidad/identidad.service.js';
import { cursosRoutes } from './modules/cursos/cursos.routes.js';
import { contenidoRoutes } from './modules/contenido/contenido.routes.js';
import { aprendizajeRoutes } from './modules/aprendizaje/aprendizaje.routes.js';
import { evaluacionesRoutes } from './modules/evaluaciones/evaluaciones.routes.js';
import { administracionRoutes } from './modules/administracion/administracion.routes.js';

/**
 * Puertos: contratos que `shared` o un módulo define y otro módulo implementa (ADR-001, ADR-004).
 * `app.ts` es el único sitio que los conecta; cada puerto nuevo se registra aquí, una sola vez.
 */
function registrarPuertos(): void {
  // `autenticar` (shared) pregunta a Identidad si la sesión del access token sigue vigente.
  registrarVerificadorSesion((usuario) => identidadService.sesionVigente(usuario));
}

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

  registrarPuertos();

  // Comprobación rápida: ¿el servidor responde y llega a PostgreSQL? (ADR-011, 11.1: sin datos internos; 11.2: 503 si la base no responde)
  app.get('/api/salud', async (_req, res) => {
    try {
      await comprobarConexion();
    } catch (error) {
      registrarEvento('salud_sin_bd', { codigoPg: (error as { code?: string }).code }, 'error');
      res.status(503).json({ estado: 'sin_bd' });
      return;
    }
    res.json({ estado: 'ok' });
  });

  // Documentación de la API (Swagger): solo en desarrollo (ADR-011, 11.3). openapi.yaml es la referencia publicada.
  if (env.NODE_ENV === 'development') {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApi));
  }

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
