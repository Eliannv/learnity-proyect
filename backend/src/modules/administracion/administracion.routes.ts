import { Router } from 'express';

import {
  autenticar,
  autorizar,
} from '../../shared/auth/middlewares.js';

import {
  administracionController as controller,
} from './administracion.controller.js';

export const administracionRoutes = Router();

administracionRoutes.get(
  '/admin/cursos',
  autenticar,
  autorizar('ADMIN'),
  controller.listar,
);

administracionRoutes.get(
  '/admin/cursos/:id',
  autenticar,
  autorizar('ADMIN'),
  controller.detalle,
);

administracionRoutes.put(
  '/admin/cursos/:id/revision',
  autenticar,
  autorizar('ADMIN'),
  controller.decidir,
);