import { Router } from 'express';
import { validarConsulta, validarParametros } from '../../shared/http/validar.js';
import { catalogoController } from './catalogo.controller.js';
import { filtrosCatalogo, idCatalogoRuta } from './catalogo.esquemas.js';

// Capa routes: catálogo público de cursos y categorías activas.
export const catalogoRoutes = Router();

catalogoRoutes.get('/categorias', catalogoController.categorias);

catalogoRoutes.get(
  '/cursos',
  validarConsulta(filtrosCatalogo),
  catalogoController.catalogo,
);

catalogoRoutes.get(
  '/cursos/:id',
  validarParametros(idCatalogoRuta),
  catalogoController.detalle,
);
