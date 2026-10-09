import { Router } from 'express';
// import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
// import { administracionController } from './administracion.controller.js';

// Módulo Administracion · Control general de la plataforma.
// Rutas previstas (se implementan en su sprint):
//   GET /admin/indicadores
//   GET /admin/usuarios
//   PUT /admin/usuarios/:id/estado
//   GET /admin/solicitudes
//   PUT /admin/solicitudes/:id
//   PUT /admin/cursos/:id/revision
//   POST /admin/categorias
//   PUT /admin/categorias/:id
export const administracionRoutes = Router();
