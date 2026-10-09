import { Router } from 'express';
// import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
// import { evaluacionesController } from './evaluaciones.controller.js';

// Módulo Evaluaciones · Preguntas, intentos y calificaciones.
// Rutas previstas (se implementan en su sprint):
//   GET /evaluaciones/:id (sin revelar es_correcta)
//   POST /evaluaciones/:id/intentos
//   PUT /evaluaciones/:id (DOCENTE: 5 a 10 preguntas, 4 opciones)
export const evaluacionesRoutes = Router();
