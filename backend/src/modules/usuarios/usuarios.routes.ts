import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { usuariosController as controller } from './usuarios.controller.js';
import {
  decisionSolicitud,
  filtroSolicitudes,
  nuevaSolicitudDocente,
  parametrosSolicitud,
} from './usuarios.esquemas.js';

// Capa routes: solicitudes para ser docente. El estudiante envía y consulta la suya; el administrador decide.
export const usuariosRoutes = Router();

usuariosRoutes.get('/solicitudes-docente/mia', autenticar, controller.miSolicitud);

usuariosRoutes.post(
  '/solicitudes-docente',
  limitarPorIp('solicitud-docente', 10, 60),
  autenticar,
  autorizar('ESTUDIANTE'),
  validarCuerpo(nuevaSolicitudDocente),
  controller.solicitarDocencia,
);

usuariosRoutes.get(
  '/admin/solicitudes',
  autenticar,
  autorizar('ADMIN'),
  validarConsulta(filtroSolicitudes),
  controller.listarSolicitudes,
);

usuariosRoutes.put(
  '/admin/solicitudes/:id',
  autenticar,
  autorizar('ADMIN'),
  validarParametros(parametrosSolicitud),
  validarCuerpo(decisionSolicitud),
  controller.decidirSolicitud,
);
