import type { PoolClient } from 'pg';
import type { UsuarioSesion } from '../../../shared/auth/tipos.js';
import { enTransaccion } from '../../../shared/database/pool.js';
import { AppError } from '../../../shared/http/app-error.js';
import type { DatosGrupo } from './grupos.esquemas.js';
import { gruposRepository as repo } from './grupos.repository.js';

function delDocente<T>(
  curso: number,
  usuario: UsuarioSesion,
  escribir: boolean,
  tarea: (db: PoolClient) => Promise<T>,
) {
  return enTransaccion(
    async (db) => {
      if (
        !usuario.roles.includes('DOCENTE') ||
        !(await repo.esPropietario(db, curso, usuario.idPersona, escribir))
      ) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      return tarea(db);
    },
    { actor: usuario.idPersona },
  );
}

export const gruposService = {
  listar: (curso: number, usuario: UsuarioSesion) =>
    delDocente(curso, usuario, false, (db) => repo.listar(db, curso)),
  guardar: (curso: number, id: number | null, datos: DatosGrupo, usuario: UsuarioSesion, revision?: number) =>
    delDocente(curso, usuario, true, async (db) => {
      try {
        if (!(await repo.guardar(db, curso, id, datos, revision)))
          throw AppError.conflicto('El grupo cambió. Revisa los miembros actuales.');
      } catch (e) {
        const codigo = (e as { code?: string }).code;
        if (codigo === '23503')
          throw AppError.solicitudInvalida('Elige solo estudiantes inscritos en este curso.');
        if (codigo === '23505') throw AppError.conflicto('Ya existe un grupo con ese nombre en el curso.');
        throw e;
      }
      return repo.listar(db, curso);
    }),
  borrar: (curso: number, grupo: number, usuario: UsuarioSesion) =>
    delDocente(curso, usuario, true, async (db) => {
      const resultado = await repo.borrar(db, curso, grupo);
      if (resultado === 'USADO')
        throw AppError.conflicto('Reasigna las lecciones de este grupo antes de eliminarlo.');
      if (resultado === 'AUSENTE') throw AppError.noEncontrado('Grupo no disponible.');
      return repo.listar(db, curso);
    }),
};
