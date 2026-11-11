import type { PoolClient } from 'pg';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type {
  DatosOcultacion, DatosReporte, DatosResena, DatosRespuesta, DatosRespuestaHilo, DecisionReporte, FiltrosBandeja, FiltrosReportes,
  FiltrosResenasAdmin, PaginacionResenas,
} from './resenas.esquemas.js';
import type {
  BandejaResenas, EntradaHistorial, HiloRespuesta, MiResena, PaginaResenas, PaginaResenasAdmin, ReporteAdmin, Resena, ResenaAdmin,
  ResenaDocente, ValoracionDocente,
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
  async listar(idCurso: number, { pagina, limite }: PaginacionResenas, idPersonaActual: number | null = null): Promise<PaginaResenas> {
    if (!(await repo.cursoPublicado(idCurso))) throw AppError.noEncontrado('Curso no disponible.');
    const [resumen, baseItems] = await Promise.all([
      repo.resumen(idCurso),
      repo.pagina(idCurso, limite, (pagina - 1) * limite),
    ]);
    const hilos = await repo.respuestasDeResenas(baseItems.map((i) => i.id), idPersonaActual);
    const items = baseItems.map((i) => ({ ...i, respuestas: hilos.get(i.id) ?? [] }));
    return {
      resumen,
      items,
      pagina, limite, total: resumen.total, totalPaginas: Math.ceil(resumen.total / limite),
    };
  },

  async mia(idCurso: number, usuario: UsuarioSesion): Promise<MiResena> {
    exigirEstudiante(usuario);
    const inscripcion = await repo.inscripcion(usuario.idPersona, idCurso);
    if (inscripcion === null) return { puedeResenar: false, resena: null, ocultada: false };
    if (await repo.ocultadaDeInscripcion(inscripcion)) return { puedeResenar: false, resena: null, ocultada: true };
    return { puedeResenar: true, resena: await repo.deInscripcion(inscripcion), ocultada: false };
  },

  async guardar(idCurso: number, datos: DatosResena, usuario: UsuarioSesion): Promise<Resena> {
    const inscripcion = await inscripcionObligatoria(idCurso, usuario);
    const guardada = await enTransaccion(
      (cliente) => repo.guardar(cliente, inscripcion, datos.estrellas, datos.comentario), { actor: usuario.idPersona });
    if (!guardada) {
      throw AppError.conflicto(
        'Tu reseña fue ocultada por moderación: no puedes editarla ni volver a publicarla.', 'RESENA_OCULTADA');
    }
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
    const [{ items: baseItems, total }, resumen, evolucion] = await Promise.all([
      repo.bandeja(usuario.idPersona, filtros),
      repo.resumenDocente(usuario.idPersona, filtros.curso),
      repo.evolucion(usuario.idPersona, filtros.curso),
    ]);
    const hilos = await repo.respuestasDeResenas(baseItems.map((i) => i.id), usuario.idPersona);
    const items = baseItems.map((i) => ({ ...i, respuestas: hilos.get(i.id) ?? [] }));
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
    const fila = (await repo.resenaDocentePorId(usuario.idPersona, idResena))!;
    const hilos = await repo.respuestasDeResenas([idResena], usuario.idPersona);
    return { ...fila, respuestas: hilos.get(idResena) ?? [] };
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
    const fila = (await repo.resenaDocentePorId(usuario.idPersona, idResena))!;
    const hilos = await repo.respuestasDeResenas([idResena], usuario.idPersona);
    return { ...fila, respuestas: hilos.get(idResena) ?? [] };
  },

  // ---------------------------------------------------------------- hilos de conversación (estudiante + docente)

  async crearRespuestaHilo(idResena: number, datos: DatosRespuestaHilo, usuario: UsuarioSesion): Promise<HiloRespuesta> {
    const ctx = await repo.contextoHiloResena(idResena, usuario.idPersona);
    if (!ctx || !ctx.visible) throw resenaNoDisponible();
    if (!ctx.esDocente && !ctx.estaInscrito) {
      throw AppError.sinPermiso(
        'Solo el docente titular o los estudiantes inscritos en este curso pueden participar en el hilo de la reseña.',
      );
    }
    const creada = await enTransaccion(
      (cliente) => repo.crearRespuestaHilo(cliente, idResena, usuario.idPersona, datos.comentario, ctx.esDocente),
      { actor: usuario.idPersona },
    );
    registrarEvento('resena_hilo_respondido', { idResena, idRespuesta: creada.id });
    return creada;
  },

  async eliminarRespuestaHilo(idResena: number, idRespuesta: number, usuario: UsuarioSesion): Promise<void> {
    await enTransaccion(
      async (cliente) => {
        const eliminada = await repo.eliminarRespuestaHilo(cliente, idResena, idRespuesta);
        if (!eliminada) throw AppError.noEncontrado('La respuesta no existe.');
        const esAutor = Number(eliminada.idPersonaAutor) === Number(usuario.idPersona);
        if (!esAutor && !usuario.roles.includes('ADMIN')) {
          throw AppError.sinPermiso('Solo puedes eliminar tus propias respuestas en el hilo.');
        }
      },
      { actor: usuario.idPersona },
    );
    registrarEvento('resena_hilo_eliminado', { idResena, idRespuesta });
  },

  // ------------------------------------------------------------ administrador

  /** Acceso total del administrador: cualquier reseña, también borradas, con su historial completo. */
  async todas(filtros: FiltrosResenasAdmin, usuario: UsuarioSesion): Promise<PaginaResenasAdmin> {
    exigirAdmin(usuario);
    const [{ items, total }, cursos] = await Promise.all([repo.todas(filtros), repo.cursosConResenas()]);
    const ids = items.map((r) => r.id);
    const [historial, hilos] = await Promise.all([
      repo.historial(ids),
      repo.respuestasDeResenas(ids, usuario.idPersona),
    ]);
    return {
      cursos,
      items: items.map(({ participantes, ...r }) => {
        const [docentePersona, autorPersona] = participantes;
        const esDocenteCurso = Number(docentePersona) === Number(usuario.idPersona);
        const esAutor = Number(autorPersona) === Number(usuario.idPersona);
        return {
          ...r,
          propia: esDocenteCurso || esAutor,
          esAutor,
          esDocenteCurso,
          respuestas: hilos.get(r.id) ?? [],
          historial: historial.get(r.id) ?? [],
        };
      }),
      pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite),
    };
  },

  async reportes(filtros: FiltrosReportes, usuario: UsuarioSesion): Promise<ReporteAdmin[]> {
    exigirAdmin(usuario);
    const reportes = await repo.reportes(filtros);
    const ids = [...new Set(reportes.map((r) => r.resena.id))];
    const [historial, hilos] = await Promise.all([
      repo.historial(ids),
      repo.respuestasDeResenas(ids, usuario.idPersona),
    ]);
    return reportes.map(({ participantes, ...r }) => {
      const [docentePersona, autorPersona] = participantes;
      const esDocenteCurso = Number(docentePersona) === Number(usuario.idPersona);
      const esAutor = Number(autorPersona) === Number(usuario.idPersona);
      return {
        ...r,
        propia: esDocenteCurso || esAutor,
        esAutor,
        esDocenteCurso,
        resena: {
          ...r.resena,
          respuestas: hilos.get(r.resena.id) ?? [],
        },
        historial: historial.get(r.resena.id) ?? [],
      };
    });
  },

  async resolverReporte(idReporte: number, { decision }: DecisionReporte, usuario: UsuarioSesion): Promise<void> {
    exigirAdmin(usuario);
    const idResena = await enTransaccion(async (cliente) => {
      const partes = await repo.partesDeReportePendiente(cliente, idReporte);
      if (partes) exigirAjeno(partes, usuario);
      return repo.resolverReporte(cliente, idReporte, usuario.idPersona, decision === 'OCULTAR');
    }, { actor: usuario.idPersona });
    if (idResena === null) throw AppError.noEncontrado('El reporte no existe o ya fue resuelto.');
    registrarEvento('reporte_resena_resuelto', { idReporte, decision });
  },

  async historial(idResena: number, usuario: UsuarioSesion): Promise<EntradaHistorial[]> {
    exigirAdmin(usuario);
    return (await repo.historial([idResena])).get(idResena) ?? [];
  },

  /** Oculta una reseña sin necesidad de un reporte previo; sus reportes pendientes quedan resueltos. */
  async ocultar(idResena: number, { motivo }: DatosOcultacion, usuario: UsuarioSesion): Promise<ResenaAdmin> {
    await moderar(idResena, usuario, async (cliente, estado) => {
      if (estado.ocultada) throw AppError.conflicto('La reseña ya está oculta.', 'RESENA_YA_OCULTADA');
      await repo.ocultar(cliente, idResena, usuario.idPersona, motivo);
    });
    registrarEvento('resena_ocultada', { idResena });
    return resenaAdmin(idResena, usuario);
  },

  async restaurar(idResena: number, usuario: UsuarioSesion): Promise<ResenaAdmin> {
    await moderar(idResena, usuario, async (cliente, estado) => {
      if (!estado.ocultada) throw AppError.conflicto('La reseña no está oculta.', 'RESENA_NO_OCULTADA');
      await repo.restaurar(cliente, idResena);
    });
    registrarEvento('resena_restaurada', { idResena });
    return resenaAdmin(idResena, usuario);
  },

  /** Retira la respuesta pública del docente; queda en el historial como RESPUESTA_RETIRADA. */
  async retirarRespuesta(idResena: number, usuario: UsuarioSesion): Promise<ResenaAdmin> {
    await moderar(idResena, usuario, async (cliente, estado) => {
      if (!estado.respondida) throw AppError.conflicto('La reseña no tiene respuesta del docente.', 'SIN_RESPUESTA');
      await repo.retirarRespuesta(cliente, idResena);
    });
    registrarEvento('resena_respuesta_retirada_admin', { idResena });
    return resenaAdmin(idResena, usuario);
  },
};

/** Acción del administrador sobre una reseña: transacción con la fila bloqueada y el administrador como actor. */
async function moderar(
  idResena: number, usuario: UsuarioSesion,
  accion: (cliente: PoolClient, estado: { ocultada: boolean; respondida: boolean }) => Promise<void>,
): Promise<void> {
  exigirAdmin(usuario);
  await enTransaccion(async (cliente) => {
    const estado = await repo.bloquearParaModerar(cliente, idResena);
    if (!estado) throw AppError.noEncontrado('La reseña no existe.');
    exigirAjeno(estado, usuario);
    await accion(cliente, estado);
  }, { actor: usuario.idPersona });
}

/** Segregación de funciones: nadie modera reseñas de sus propios cursos ni las que escribió. */
function exigirAjeno(partes: { idPersonaDocente: number; idPersonaAutor: number }, usuario: UsuarioSesion): void {
  if (Number(partes.idPersonaDocente) === Number(usuario.idPersona) || Number(partes.idPersonaAutor) === Number(usuario.idPersona)) {
    throw AppError.sinPermiso('No puedes moderar reseñas de tus propios cursos ni tus propias reseñas. Otro administrador debe hacerlo.');
  }
}

async function resenaAdmin(idResena: number, usuario: UsuarioSesion): Promise<ResenaAdmin> {
  const [fila, historial, hilos] = await Promise.all([
    repo.resenaAdminPorId(idResena),
    repo.historial([idResena]),
    repo.respuestasDeResenas([idResena], usuario.idPersona),
  ]);
  const { participantes, ...resena } = fila!;
  const [docentePersona, autorPersona] = participantes;
  const esDocenteCurso = Number(docentePersona) === Number(usuario.idPersona);
  const esAutor = Number(autorPersona) === Number(usuario.idPersona);
  return {
    ...resena,
    propia: esDocenteCurso || esAutor,
    esAutor,
    esDocenteCurso,
    respuestas: hilos.get(idResena) ?? [],
    historial: historial.get(idResena) ?? [],
  };
}

function exigirDocente(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('DOCENTE')) throw AppError.sinPermiso();
}

function exigirAdmin(usuario: UsuarioSesion): void {
  if (!usuario.roles.includes('ADMIN')) throw AppError.sinPermiso();
}

/** Mismo 404 si no existe, está borrada o es de otro docente: no revela reseñas ajenas. */
const resenaNoDisponible = () => AppError.noEncontrado('Reseña no disponible.');
