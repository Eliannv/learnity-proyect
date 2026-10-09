import { Router } from 'express';
// import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
// import { cursosController } from './cursos.controller.js';

// Módulo Cursos · Cursos, módulos, lecciones, categorías y catálogo.
// Rutas previstas (se implementan en su sprint):
//   GET /cursos (catálogo público)
//   GET /cursos/:id (detalle)
//   POST /cursos (DOCENTE)
//   PUT /cursos/:id (DOCENTE dueño)
//   POST /cursos/:id/modulos
//   POST /modulos/:id/lecciones
//   POST /cursos/:id/enviar-revision
//   GET /categorias
export const cursosRoutes = Router();
