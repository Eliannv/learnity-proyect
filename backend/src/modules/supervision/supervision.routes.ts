import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { validarConsulta } from '../../shared/http/validar.js';
import { supervisionController as controller } from './supervision.controller.js';
import { consultaVacia, filtroAccesos } from './supervision.esquemas.js';

// Supervisión del administrador (solo lectura): registro de accesos y cuentas bloqueadas.
export const supervisionRoutes = Router();

supervisionRoutes.get('/admin/accesos', autenticar, autorizar('ADMIN'),
  validarConsulta(filtroAccesos), controller.accesos);
supervisionRoutes.get('/admin/accesos/bloqueadas', autenticar, autorizar('ADMIN'),
  validarConsulta(consultaVacia), controller.cuentasBloqueadas);
