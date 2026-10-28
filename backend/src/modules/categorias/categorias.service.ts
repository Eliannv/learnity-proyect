import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type { DatosCategoria, DatosCategoriaNueva } from './categorias.esquemas.js';
import type { CategoriaAdmin } from './categorias.modelo.js';
import { categoriasRepository as repo } from './categorias.repository.js';

const DUPLICADA = 'Ya existe una categoría con ese nombre.';

function exigirAdmin(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('ADMIN')) throw AppError.sinPermiso();
}

/** La carrera entre dos administradores la cierra el índice único: su 23505 es el mismo 409. */
async function sinDuplicados<T>(tarea: () => Promise<T>): Promise<T> {
  try {
    return await tarea();
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw AppError.conflicto(DUPLICADA, 'CATEGORIA_DUPLICADA');
    }
    throw error;
  }
}

export const categoriasService = {
  async listar(usuario: UsuarioSesion): Promise<CategoriaAdmin[]> {
    exigirAdmin(usuario);
    return repo.listar();
  },

  async crear(datos: DatosCategoriaNueva, usuario: UsuarioSesion): Promise<CategoriaAdmin> {
    exigirAdmin(usuario);
    const categoria = await sinDuplicados(() => enTransaccion(async (cliente) => {
      if (await repo.nombreOcupado(cliente, datos.nombre)) {
        throw AppError.conflicto(DUPLICADA, 'CATEGORIA_DUPLICADA');
      }
      const id = await repo.crear(cliente, datos.nombre, datos.descripcion, usuario.idPersona);
      return (await repo.buscar(cliente, id))!;
    }, { actor: usuario.idPersona }));
    registrarEvento('categoria_creada', { idCategoria: categoria.id, activa: true });
    return categoria;
  },

  /** Reemplazo completo. Desactivar no toca los cursos; solo deja de ofrecerse al crearlos o editarlos. */
  async actualizar(id: number, datos: DatosCategoria, usuario: UsuarioSesion): Promise<CategoriaAdmin> {
    exigirAdmin(usuario);
    const categoria = await sinDuplicados(() => enTransaccion(async (cliente) => {
      if (await repo.nombreOcupado(cliente, datos.nombre, id)) {
        throw AppError.conflicto(DUPLICADA, 'CATEGORIA_DUPLICADA');
      }
      if (!(await repo.actualizar(cliente, id, datos.nombre, datos.descripcion, datos.activa))) {
        throw AppError.noEncontrado('Categoría no encontrada.');
      }
      return (await repo.buscar(cliente, id))!;
    }, { actor: usuario.idPersona }));
    registrarEvento('categoria_actualizada', { idCategoria: id, activa: categoria.activa });
    return categoria;
  },
};
