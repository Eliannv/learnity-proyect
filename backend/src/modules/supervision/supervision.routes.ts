import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { supervisionController as controller } from './supervision.controller.js';
import {
  atencionAlerta, consultaVacia, filtroAccesos, filtroAlertas, filtroAuditoria, filtroSesiones, idAlerta, idCambio,
  idSesion, revocacionSesion,
} from './supervision.esquemas.js';

// Supervisión del administrador: resumen, accesos, cuentas bloqueadas, auditoría, salud de la base, sesiones y alertas.
export const supervisionRoutes = Router();

supervisionRoutes.get('/admin/resumen', autenticar, autorizar('ADMIN'),
  validarConsulta(consultaVacia), controller.resumen);

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

supervisionRoutes.get('/admin/alertas', autenticar, autorizar('ADMIN'),
  validarConsulta(filtroAlertas), controller.alertas);
supervisionRoutes.post('/admin/alertas/analisis', limitarPorIp('analisis_alertas', 30, 15), autenticar, autorizar('ADMIN'),
  validarConsulta(consultaVacia), controller.analizarAlertas);
supervisionRoutes.put('/admin/alertas/:id/atencion', autenticar, autorizar('ADMIN'), validarParametros(idAlerta),
  validarCuerpo(atencionAlerta, 'Revisa la nota.'), controller.atenderAlerta);

supervisionRoutes.get('/admin/sesiones', autenticar, autorizar('ADMIN'),
  validarConsulta(filtroSesiones), controller.sesiones);
supervisionRoutes.delete('/admin/sesiones/:id', autenticar, autorizar('ADMIN'),
  validarParametros(idSesion), validarConsulta(revocacionSesion), controller.revocarSesion);
