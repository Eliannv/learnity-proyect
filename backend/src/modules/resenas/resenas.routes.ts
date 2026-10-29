import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { resenasController as controller } from './resenas.controller.js';
import {
  datosReporte, datosResena, datosRespuesta, decisionReporte, filtrosBandeja, filtrosReportes, filtrosResenasAdmin,
  idCursoResenas, idResena, paginacionResenas,
} from './resenas.esquemas.js';

// Reseñas de cursos: la lectura es pública; escribir exige estar inscrito en el curso publicado.
// El docente gestiona las de sus cursos y el administrador modera los reportes.
export const resenasRoutes = Router();

resenasRoutes.get('/cursos/:id/resenas', validarParametros(idCursoResenas),
  validarConsulta(paginacionResenas), controller.listar);
resenasRoutes.get('/cursos/:id/resena', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idCursoResenas), controller.mia);
resenasRoutes.put('/cursos/:id/resena', limitarPorIp('resena', 30, 15), autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idCursoResenas), validarCuerpo(datosResena, 'Revisa tu reseña.'), controller.guardar);
resenasRoutes.delete('/cursos/:id/resena', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idCursoResenas), controller.eliminar);

resenasRoutes.get('/docente/resenas', autenticar, autorizar('DOCENTE'),
  validarConsulta(filtrosBandeja), controller.bandeja);
resenasRoutes.get('/docente/valoracion', autenticar, autorizar('DOCENTE'), controller.valoracion);
resenasRoutes.put('/docente/resenas/:id/respuesta', limitarPorIp('respuesta_resena', 60, 15), autenticar,
  autorizar('DOCENTE'), validarParametros(idResena), validarCuerpo(datosRespuesta, 'Revisa tu respuesta.'),
  controller.responder);
resenasRoutes.delete('/docente/resenas/:id/respuesta', autenticar, autorizar('DOCENTE'),
  validarParametros(idResena), controller.retirarRespuesta);
resenasRoutes.post('/docente/resenas/:id/reporte', limitarPorIp('reporte_resena', 20, 15), autenticar,
  autorizar('DOCENTE'), validarParametros(idResena), validarCuerpo(datosReporte, 'Revisa el reporte.'),
  controller.reportar);

resenasRoutes.get('/admin/resenas', autenticar, autorizar('ADMIN'),
  validarConsulta(filtrosResenasAdmin), controller.todas);
resenasRoutes.get('/admin/resenas/reportes', autenticar, autorizar('ADMIN'),
  validarConsulta(filtrosReportes), controller.reportes);
resenasRoutes.put('/admin/resenas/reportes/:id', autenticar, autorizar('ADMIN'),
  validarParametros(idResena), validarCuerpo(decisionReporte), controller.resolverReporte);
resenasRoutes.get('/admin/resenas/:id/historial', autenticar, autorizar('ADMIN'),
  validarParametros(idResena), controller.historial);
