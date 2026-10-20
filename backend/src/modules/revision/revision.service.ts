import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { cursosApi, type DecisionRevision } from '../cursos/index.js';

export const revisionService = {
  listar: (usuario: UsuarioSesion) => cursosApi.listarParaRevision(usuario),
  detalle: (id: number, usuario: UsuarioSesion) => cursosApi.detalleParaRevision(id, usuario),
  decidir: (id: number, datos: DecisionRevision, usuario: UsuarioSesion) =>
    cursosApi.decidirRevision(id, datos, usuario),
};
