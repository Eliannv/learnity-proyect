import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { evaluacionesController as controller } from './evaluaciones.controller.js';
import { datosIntentoSchema, idEvaluacionRuta } from './evaluaciones.esquemas.js';

// Módulo Evaluaciones · el estudiante inscrito responde; el docente edita las preguntas desde Cursos
// (PUT /lecciones/:id/evaluacion).
export const evaluacionesRoutes = Router();

evaluacionesRoutes.get('/evaluaciones/:id', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idEvaluacionRuta), controller.obtener);
evaluacionesRoutes.post('/evaluaciones/:id/intentos', limitarPorIp('intento_evaluacion', 60, 15),
  autenticar, autorizar('ESTUDIANTE'), validarParametros(idEvaluacionRuta),
  validarCuerpo(datosIntentoSchema, 'Revisa tus respuestas.'), controller.responder);
