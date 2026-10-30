import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { validarConsulta, validarParametros } from '../../shared/http/validar.js';
import { supervisionController as controller } from './supervision.controller.js';
import {
  consultaVacia, filtroAccesos, filtroAuditoria, filtroSesiones, idCambio, idSesion, revocacionSesion,
} from './supervision.esquemas.js';

// Supervisión del administrador: registro de accesos, cuentas bloqueadas, auditoría, salud de la base y sesiones.
export const supervisionRoutes = Router();

supervisionRoutes.get('/admin/accesos', autenticar, autorizar('ADMIN'),
  validarConsulta(filtroAccesos), controller.accesos);
supervisionRoutes.get('/admin/accesos/bloqueadas', autenticar, autorizar('ADMIN'),
  validarConsulta(consultaVacia), controller.cuentasBloqueadas);

supervisionRoutes.get('/admin/auditoria', autenticar, autorizar('ADMIN'),
  validarConsulta(filtroAuditoria), controller.auditoria);
supervisionRoutes.get('/admin/auditoria/opciones', autenticar, autorizar('ADMIN'),
  validarConsulta(consultaVacia), controller.opcionesAuditoria);
supervisionRoutes.get('/admin/auditoria/:id', autenticar, autorizar('ADMIN'),
  validarParametros(idCambio), controller.detalleAuditoria);

supervisionRoutes.get('/admin/base-datos', autenticar, autorizar('ADMIN'),
  validarConsulta(consultaVacia), controller.estadoBaseDatos);

supervisionRoutes.get('/admin/sesiones', autenticar, autorizar('ADMIN'),
  validarConsulta(filtroSesiones), controller.sesiones);
supervisionRoutes.delete('/admin/sesiones/:id', autenticar, autorizar('ADMIN'),
  validarParametros(idSesion), validarConsulta(revocacionSesion), controller.revocarSesion);
