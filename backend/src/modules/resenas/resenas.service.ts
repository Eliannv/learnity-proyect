import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type { DatosResena, PaginacionResenas } from './resenas.esquemas.js';
import type { MiResena, PaginaResenas, Resena } from './resenas.modelo.js';
import { resenasRepository as repo } from './resenas.repository.js';

function exigirEstudiante(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('ESTUDIANTE')) throw AppError.sinPermiso();
}

/** Solo quien está inscrito en el curso publicado puede reseñarlo. */
async function inscripcionObligatoria(idCurso: number, usuario: UsuarioSesion): Promise<number> {
  exigirEstudiante(usuario);
  const id = await repo.inscripcion(usuario.idPersona, idCurso);
  if (id === null) {
    throw AppError.sinPermiso('Inscríbete en el curso para dejar tu reseña.', 'NO_INSCRITO');
  }
  return id;
}

export const resenasService = {
  async listar(idCurso: number, { pagina, limite }: PaginacionResenas): Promise<PaginaResenas> {
    if (!(await repo.cursoPublicado(idCurso))) throw AppError.noEncontrado('Curso no disponible.');
    const resumen = await repo.resumen(idCurso);
    return {
      resumen,
      items: await repo.pagina(idCurso, limite, (pagina - 1) * limite),
      pagina, limite, total: resumen.total, totalPaginas: Math.ceil(resumen.total / limite),
    };
  },

  async mia(idCurso: number, usuario: UsuarioSesion): Promise<MiResena> {
    exigirEstudiante(usuario);
    const inscripcion = await repo.inscripcion(usuario.idPersona, idCurso);
    return {
      puedeResenar: inscripcion !== null,
      resena: inscripcion === null ? null : await repo.deInscripcion(inscripcion),
    };
  },

  async guardar(idCurso: number, datos: DatosResena, usuario: UsuarioSesion): Promise<Resena> {
    const inscripcion = await inscripcionObligatoria(idCurso, usuario);
    await enTransaccion((cliente) => repo.guardar(cliente, inscripcion, datos.estrellas, datos.comentario),
      { actor: usuario.idPersona });
    registrarEvento('resena_guardada', { idCurso, estrellas: datos.estrellas });
    return (await repo.deInscripcion(inscripcion))!;
  },

  async eliminar(idCurso: number, usuario: UsuarioSesion): Promise<void> {
    const inscripcion = await inscripcionObligatoria(idCurso, usuario);
    const borrada = await enTransaccion((cliente) => repo.eliminar(cliente, inscripcion), { actor: usuario.idPersona });
    if (!borrada) throw AppError.noEncontrado('Todavía no has reseñado este curso.');
  },
};
