import { Router } from 'express';
import { cursosController } from './cursos.controller.js';
import {
  autenticar,
  autorizar,
} from '../../shared/auth/middlewares.js';

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
cursosRoutes.get('/categorias', cursosController.categorias);
cursosRoutes.get('/cursos', cursosController.catalogo);
cursosRoutes.get('/cursos/:id', cursosController.detalle);
cursosRoutes.get(
  '/docente/cursos',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.listarMisCursos,
);
cursosRoutes.get(
  '/docente/cursos/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.obtenerMiCurso,
);
cursosRoutes.post(
  '/cursos',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.crearCurso,
);
cursosRoutes.put(
  '/cursos/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.actualizarMiCurso,
);
cursosRoutes.post(
  '/cursos/:id/modulos',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.crearModulo,
);
cursosRoutes.put(
  '/modulos/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.actualizarModulo,
);
cursosRoutes.delete(
  '/modulos/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.eliminarModulo,
);
cursosRoutes.post(
  '/modulos/:id/lecciones',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.crearLeccion,
);
cursosRoutes.put(
  '/lecciones/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.actualizarLeccion,
);
cursosRoutes.put(
  '/lecciones/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.actualizarLeccion,
);
cursosRoutes.delete(
  '/lecciones/:id',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.eliminarLeccion,
);
cursosRoutes.post(
  '/cursos/:id/enviar-revision',
  autenticar,
  autorizar('DOCENTE'),
  cursosController.enviarCursoARevision,
);