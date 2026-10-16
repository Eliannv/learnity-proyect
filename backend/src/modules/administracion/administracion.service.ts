import type {
  UsuarioSesion,
} from '../../shared/auth/tipos.js';

import type {
  DecisionRevision,
} from '../cursos/cursos-privados.model.js';

import {
  cursosService,
} from '../cursos/cursos.service.js';

export const administracionService = {
  listar: (
    usuario: UsuarioSesion,
  ) => cursosService.listarParaRevision(
    usuario,
  ),

  detalle: (
    id: number,
    usuario: UsuarioSesion,
  ) => cursosService.detalleParaRevision(
    id,
    usuario,
  ),

  decidir: (
    id: number,
    datos: DecisionRevision,
    usuario: UsuarioSesion,
  ) => cursosService.decidirRevision(
    id,
    datos,
    usuario,
  ),
};