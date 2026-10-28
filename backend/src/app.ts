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
import { identidadApi, identidadRoutes } from './modules/identidad/index.js';
import { catalogoRoutes } from './modules/catalogo/index.js';
import {
  cursosRoutes,
  registrarLiberadorArchivos,
} from './modules/cursos/index.js';
import {
  contenidoRoutes,
  liberadorArchivos,
} from './modules/contenido/index.js';
import { revisionRoutes } from './modules/revision/index.js';
import { usuariosRoutes } from './modules/usuarios/index.js';
import { aprendizajeRoutes } from './modules/aprendizaje/index.js';
import { evaluacionesRoutes } from './modules/evaluaciones/index.js';
import { categoriasRoutes } from './modules/categorias/index.js';
import { resenasRoutes } from './modules/resenas/index.js';

/**
 * Puertos: contratos que `shared` o un módulo define y otro módulo implementa (ADR-001, ADR-004).
 * `app.ts` es el único sitio que los conecta; cada puerto nuevo se registra aquí, una sola vez.
 */
function registrarPuertos(): void {
  // `autenticar` (shared) pregunta a Identidad si la sesión del access token sigue vigente y obtiene los roles actuales.
  registrarVerificadorSesion((usuario) => identidadApi.sesionVigente(usuario));
  // `cursos` pide a `contenido` retirar los PDF que queden sin referencia al borrar lecciones o módulos.
  registrarLiberadorArchivos(liberadorArchivos);
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

  // Módulos del monolito. Cada uno solo expone su API pública desde `index.ts` (R3).
  const api = express.Router();
  api.use(identidadRoutes);
  api.use(catalogoRoutes);
  api.use(cursosRoutes);
  api.use(contenidoRoutes);
  api.use(revisionRoutes);
  api.use(usuariosRoutes);
  api.use(aprendizajeRoutes);
  api.use(evaluacionesRoutes);
  api.use(categoriasRoutes);
  api.use(resenasRoutes);
  app.use('/api', api);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);
  return app;
}
