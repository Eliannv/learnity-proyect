import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type {
  DatosReporte, DatosResena, DatosRespuesta, DecisionReporte, FiltrosBandeja, FiltrosReportes, FiltrosResenasAdmin,
  PaginacionResenas,
} from './resenas.esquemas.js';
import type {
  BandejaResenas, EntradaHistorial, MiResena, PaginaResenas, PaginaResenasAdmin, ReporteAdmin, Resena, ResenaDocente,
  ValoracionDocente,
} from './resenas.modelo.js';
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

  /** Borrado lógico: deja de contar en el promedio, pero el docente y la moderación conservan su historia. */
  async eliminar(idCurso: number, usuario: UsuarioSesion): Promise<void> {
    const inscripcion = await inscripcionObligatoria(idCurso, usuario);
    const borrada = await enTransaccion((cliente) => repo.eliminar(cliente, inscripcion), { actor: usuario.idPersona });
    if (!borrada) throw AppError.noEncontrado('Todavía no has reseñado este curso.');
  },

  // ---------------------------------------------------------------- docente

  async bandeja(filtros: FiltrosBandeja, usuario: UsuarioSesion): Promise<BandejaResenas> {
    exigirDocente(usuario);
    const cursos = await repo.cursosDelDocente(usuario.idPersona);
    if (filtros.curso !== undefined && !cursos.some((c) => c.id === filtros.curso)) {
      throw AppError.noEncontrado('Curso no disponible.');
    }
    const [{ items, total }, resumen, evolucion] = await Promise.all([
      repo.bandeja(usuario.idPersona, filtros),
      repo.resumenDocente(usuario.idPersona, filtros.curso),
      repo.evolucion(usuario.idPersona, filtros.curso),
    ]);
    return {
      cursos, resumen, evolucion, items,
      pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite),
    };
  },

  async valoracion(usuario: UsuarioSesion): Promise<ValoracionDocente> {
    exigirDocente(usuario);
    return repo.valoracionDocente(usuario.idPersona);
  },

  /** Responder públicamente (o reemplazar la respuesta). `null` la retira. */
  async responder(idResena: number, datos: DatosRespuesta | null, usuario: UsuarioSesion): Promise<ResenaDocente> {
    exigirDocente(usuario);
    await enTransaccion(async (cliente) => {
      if (!(await repo.resenaDelDocente(cliente, idResena, usuario.idPersona))) throw resenaNoDisponible();
      await repo.responder(cliente, idResena, datos?.texto ?? null);
    }, { actor: usuario.idPersona });
    registrarEvento(datos ? 'resena_respondida' : 'resena_respuesta_retirada', { idResena });
    return (await repo.resenaDocentePorId(usuario.idPersona, idResena))!;
  },

  async reportar(idResena: number, datos: DatosReporte, usuario: UsuarioSesion): Promise<ResenaDocente> {
    exigirDocente(usuario);
    const yaPendiente = await enTransaccion(async (cliente) => {
      if (!(await repo.resenaDelDocente(cliente, idResena, usuario.idPersona))) throw resenaNoDisponible();
      return repo.reportar(cliente, idResena, usuario.idPersona, datos);
    }, { actor: usuario.idPersona });
    if (yaPendiente) {
      throw AppError.conflicto('Esta reseña ya tiene un reporte pendiente de revisión.', 'REPORTE_PENDIENTE');
    }
    registrarEvento('resena_reportada', { idResena, motivo: datos.motivo });
    return (await repo.resenaDocentePorId(usuario.idPersona, idResena))!;
  },

  // ------------------------------------------------------------ administrador

  /** Acceso total del administrador: cualquier reseña, también borradas, con su historial completo. */
  async todas(filtros: FiltrosResenasAdmin, usuario: UsuarioSesion): Promise<PaginaResenasAdmin> {
    exigirAdmin(usuario);
    const { items, total } = await repo.todas(filtros);
    const historial = await repo.historial(items.map((r) => r.id));
    return {
      items: items.map((r) => ({ ...r, historial: historial.get(r.id) ?? [] })),
      pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite),
    };
  },

  async reportes({ estado }: FiltrosReportes, usuario: UsuarioSesion): Promise<ReporteAdmin[]> {
    exigirAdmin(usuario);
    const reportes = await repo.reportes(estado);
    const historial = await repo.historial([...new Set(reportes.map((r) => r.resena.id))]);
    return reportes.map((r) => ({ ...r, historial: historial.get(r.resena.id) ?? [] }));
  },

  async resolverReporte(idReporte: number, { decision }: DecisionReporte, usuario: UsuarioSesion): Promise<void> {
    exigirAdmin(usuario);
    const idResena = await enTransaccion(
      (cliente) => repo.resolverReporte(cliente, idReporte, usuario.idPersona, decision === 'OCULTAR'),
      { actor: usuario.idPersona },
    );
    if (idResena === null) throw AppError.noEncontrado('El reporte no existe o ya fue resuelto.');
    registrarEvento('reporte_resena_resuelto', { idReporte, decision });
  },

  async historial(idResena: number, usuario: UsuarioSesion): Promise<EntradaHistorial[]> {
    exigirAdmin(usuario);
    return (await repo.historial([idResena])).get(idResena) ?? [];
  },
};

function exigirDocente(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('DOCENTE')) throw AppError.sinPermiso();
}

function exigirAdmin(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('ADMIN')) throw AppError.sinPermiso();
}

/** Mismo 404 si no existe, está borrada o es de otro docente: no revela reseñas ajenas. */
const resenaNoDisponible = () => AppError.noEncontrado('Reseña no disponible.');
