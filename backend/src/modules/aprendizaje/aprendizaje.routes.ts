import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarCuerpo, validarConsulta, validarParametros } from '../../shared/http/validar.js';
import { aprendizajeController as controller } from './aprendizaje.controller.js';
import {
  filtrosEstudiantesDocenteSchema, idAprendizajeRuta, paginacionEstudiantesSchema, progresoLeccionSchema,
} from './aprendizaje.esquemas.js';

import { gruposController as grupos } from './grupos/grupos.controller.js';
import { cursoGrupo, grupoRuta, grupoNuevo, grupoEditado } from './grupos/grupos.esquemas.js';

export const aprendizajeRoutes = Router();

aprendizajeRoutes.post('/cursos/:id/inscripcion', limitarPorIp('inscripcion', 30, 15),
  autenticar, autorizar('ESTUDIANTE'), validarParametros(idAprendizajeRuta), controller.inscribir);
aprendizajeRoutes.get('/mi-aprendizaje', autenticar, autorizar('ESTUDIANTE'), controller.listar);
aprendizajeRoutes.get('/mi-aprendizaje/cursos/:id', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idAprendizajeRuta), controller.detalle);
aprendizajeRoutes.put('/lecciones/:id/progreso', limitarPorIp('progreso_leccion', 240, 15),
  autenticar, autorizar('ESTUDIANTE'), validarParametros(idAprendizajeRuta),
  validarCuerpo(progresoLeccionSchema), controller.guardarProgreso);
aprendizajeRoutes.get('/docente/estudiantes', autenticar, autorizar('DOCENTE', 'ADMIN'),
  validarConsulta(filtrosEstudiantesDocenteSchema), controller.seguimientoGeneral);
aprendizajeRoutes.get('/docente/cursos/:id/estudiantes', autenticar, autorizar('DOCENTE', 'ADMIN'),
  validarParametros(idAprendizajeRuta), validarConsulta(paginacionEstudiantesSchema), controller.seguimiento);
aprendizajeRoutes.get('/docente/cursos/:id/estudiantes/exportar', limitarPorIp('exportar_estudiantes', 30, 15),
  autenticar, autorizar('DOCENTE', 'ADMIN'), validarParametros(idAprendizajeRuta), controller.exportarEstudiantes);

const gruposCurso = '/docente/cursos/:id/grupos';
const docente = [autenticar, autorizar('DOCENTE')];
aprendizajeRoutes.get(gruposCurso, ...docente, validarParametros(cursoGrupo), grupos.listar);
aprendizajeRoutes.post(gruposCurso, ...docente, validarParametros(cursoGrupo), validarCuerpo(grupoNuevo), grupos.crear);
aprendizajeRoutes.put(gruposCurso + '/:grupo', ...docente, validarParametros(grupoRuta), validarCuerpo(grupoEditado), grupos.editar);
aprendizajeRoutes.delete(gruposCurso + '/:grupo', ...docente, validarParametros(grupoRuta), grupos.borrar);
