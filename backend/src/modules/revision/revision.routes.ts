import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { revisionController as controller } from './revision.controller.js';
import { decisionRevision, filtroRevision, idRevisionRuta } from './revision.esquemas.js';

export const revisionRoutes = Router();

revisionRoutes.get(
  '/admin/cursos',
  autenticar,
  autorizar('ADMIN'),
  validarConsulta(filtroRevision),
  controller.listar,
);

revisionRoutes.get(
  '/admin/cursos/:id',
  autenticar,
  autorizar('ADMIN'),
  validarParametros(idRevisionRuta),
  controller.detalle,
);

revisionRoutes.put(
  '/admin/cursos/:id/revision',
  autenticar,
  autorizar('ADMIN'),
  validarParametros(idRevisionRuta),
  validarCuerpo(decisionRevision),
  controller.decidir,
);
