import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { cursosController } from './cursos.controller.js';
import {
  datosCursoSchema,
  datosLeccionSchema,
  datosModuloSchema,
  idCursoRuta,
} from './cursos.esquemas.js';

// Capa routes: gestión privada de cursos, módulos y lecciones del docente.
export const cursosRoutes = Router();

cursosRoutes.get(
  '/lecciones/:id/video-preview',
  limitarPorIp('video-preview', 120, 15),
  validarParametros(idCursoRuta),
  cursosController.videoVistaPrevia,
);

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
  validarParametros(idCursoRuta),
  cursosController.obtenerMiCurso,
);

cursosRoutes.post(
  '/cursos',
  autenticar,
  autorizar('DOCENTE'),
  validarCuerpo(datosCursoSchema),
  cursosController.crearCurso,
);

cursosRoutes.put(
  '/cursos/:id',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  validarCuerpo(datosCursoSchema),
  cursosController.actualizarMiCurso,
);

cursosRoutes.post(
  '/cursos/:id/modulos',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  validarCuerpo(datosModuloSchema, 'Revisa los datos del módulo.'),
  cursosController.crearModulo,
);

cursosRoutes.put(
  '/modulos/:id',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  validarCuerpo(datosModuloSchema, 'Revisa los datos del módulo.'),
  cursosController.actualizarModulo,
);

cursosRoutes.delete(
  '/modulos/:id',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  cursosController.eliminarModulo,
);

cursosRoutes.post(
  '/modulos/:id/lecciones',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  validarCuerpo(datosLeccionSchema, 'Revisa los datos de la lección.'),
  cursosController.crearLeccion,
);

cursosRoutes.put(
  '/lecciones/:id',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  validarCuerpo(datosLeccionSchema, 'Revisa los datos de la lección.'),
  cursosController.actualizarLeccion,
);

cursosRoutes.delete(
  '/lecciones/:id',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  cursosController.eliminarLeccion,
);

cursosRoutes.post(
  '/cursos/:id/enviar-revision',
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idCursoRuta),
  cursosController.enviarCursoARevision,
);
