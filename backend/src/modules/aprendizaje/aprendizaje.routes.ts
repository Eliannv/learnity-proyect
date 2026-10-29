import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarCuerpo, validarConsulta, validarParametros } from '../../shared/http/validar.js';
import { aprendizajeController as controller } from './aprendizaje.controller.js';
import { idAprendizajeRuta, paginacionEstudiantesSchema, progresoLeccionSchema } from './aprendizaje.esquemas.js';

export const aprendizajeRoutes = Router();

aprendizajeRoutes.post('/cursos/:id/inscripcion', limitarPorIp('inscripcion', 30, 15),
  autenticar, autorizar('ESTUDIANTE'), validarParametros(idAprendizajeRuta), controller.inscribir);
aprendizajeRoutes.get('/mi-aprendizaje', autenticar, autorizar('ESTUDIANTE'), controller.listar);
aprendizajeRoutes.get('/mi-aprendizaje/cursos/:id', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idAprendizajeRuta), controller.detalle);
aprendizajeRoutes.put('/lecciones/:id/progreso', limitarPorIp('progreso_leccion', 240, 15),
  autenticar, autorizar('ESTUDIANTE'), validarParametros(idAprendizajeRuta),
  validarCuerpo(progresoLeccionSchema), controller.guardarProgreso);
aprendizajeRoutes.get('/docente/cursos/:id/estudiantes', autenticar, autorizar('DOCENTE', 'ADMIN'),
  validarParametros(idAprendizajeRuta), validarConsulta(paginacionEstudiantesSchema), controller.seguimiento);
aprendizajeRoutes.get('/docente/cursos/:id/estudiantes/exportar', limitarPorIp('exportar_estudiantes', 30, 15),
  autenticar, autorizar('DOCENTE', 'ADMIN'), validarParametros(idAprendizajeRuta), controller.exportarEstudiantes);
