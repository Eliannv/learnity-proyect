import { Router } from 'express';

import {
  autenticar,
  autorizar,
} from '../../shared/auth/middlewares.js';

import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarCuerpo } from '../../shared/http/validar.js';

import {
  administracionController as controller,
} from './administracion.controller.js';

import { nuevaSolicitudDocente } from './administracion.esquemas.js';

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

// Solicitudes para ser docente: el estudiante envía y consulta la suya; el administrador decide.
administracionRoutes.get(
  '/solicitudes-docente/mia',
  autenticar,
  controller.miSolicitud,
);

administracionRoutes.post(
  '/solicitudes-docente',
  limitarPorIp('solicitud-docente', 10, 60),
  autenticar,
  autorizar('ESTUDIANTE'),
  validarCuerpo(nuevaSolicitudDocente),
  controller.solicitarDocencia,
);

administracionRoutes.get(
  '/admin/solicitudes',
  autenticar,
  autorizar('ADMIN'),
  controller.listarSolicitudes,
);

administracionRoutes.put(
  '/admin/solicitudes/:id',
  autenticar,
  autorizar('ADMIN'),
  controller.decidirSolicitud,
);