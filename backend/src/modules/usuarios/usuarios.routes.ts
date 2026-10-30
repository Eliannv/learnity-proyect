import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { usuariosController as controller } from './usuarios.controller.js';
import {
  cambioEstadoUsuario,
  cambioRolesUsuario,
  decisionSolicitud,
  filtroSolicitudes,
  filtroUsuariosAdmin,
  nuevaSolicitudDocente,
  parametrosSolicitud,
  parametrosUsuario,
} from './usuarios.esquemas.js';

// Capa routes: solicitudes para ser docente y gestión de usuarios por administrador (RF-21).
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

usuariosRoutes.get(
  '/admin/usuarios',
  autenticar,
  autorizar('ADMIN'),
  validarConsulta(filtroUsuariosAdmin),
  controller.listarUsuarios,
);

usuariosRoutes.put(
  '/admin/usuarios/:id/estado',
  autenticar,
  autorizar('ADMIN'),
  validarParametros(parametrosUsuario),
  validarCuerpo(cambioEstadoUsuario),
  controller.cambiarEstado,
);

usuariosRoutes.delete(
  '/admin/usuarios/:id/bloqueo',
  autenticar,
  autorizar('ADMIN'),
  validarParametros(parametrosUsuario),
  controller.desbloquear,
);

usuariosRoutes.put(
  '/admin/usuarios/:id/roles',
  autenticar,
  autorizar('ADMIN'),
  validarParametros(parametrosUsuario),
  validarCuerpo(cambioRolesUsuario),
  controller.cambiarRoles,
);
