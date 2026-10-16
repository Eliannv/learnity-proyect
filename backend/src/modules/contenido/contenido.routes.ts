import { Router } from 'express';

import {
  autenticar,
  autorizar,
} from '../../shared/auth/middlewares.js';

import {
  contenidoController as controller,
} from './contenido.controller.js';

import {
  recibirPdf,
} from './contenido.multipart.js';

export const contenidoRoutes = Router();

contenidoRoutes.post(
  '/lecciones/:id/archivo',
  autenticar,
  autorizar('DOCENTE'),
  controller.autorizarCarga,
  recibirPdf,
  controller.subir,
);

contenidoRoutes.get(
  '/archivos/:id',
  autenticar,
  autorizar('DOCENTE', 'ADMIN'),
  controller.descargar,
);