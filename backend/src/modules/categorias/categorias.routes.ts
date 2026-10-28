import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { categoriasController as controller } from './categorias.controller.js';
import {
  consultaCategorias, datosCategoria, datosCategoriaNueva, parametrosCategoria,
} from './categorias.esquemas.js';

// Categorías del administrador (ADR-012). La lectura pública sigue en GET /api/categorias (catálogo).
export const categoriasRoutes = Router();

categoriasRoutes.get('/admin/categorias', autenticar, autorizar('ADMIN'),
  validarConsulta(consultaCategorias), controller.listar);
categoriasRoutes.post('/admin/categorias', autenticar, autorizar('ADMIN'),
  validarCuerpo(datosCategoriaNueva, 'Revisa los datos de la categoría.'), controller.crear);
categoriasRoutes.put('/admin/categorias/:id', autenticar, autorizar('ADMIN'),
  validarParametros(parametrosCategoria),
  validarCuerpo(datosCategoria, 'Revisa los datos de la categoría.'), controller.actualizar);
