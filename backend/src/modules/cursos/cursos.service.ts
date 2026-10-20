import type { PoolClient } from 'pg';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { enTransaccion } from '../../shared/database/pool.js';
import { AppError } from '../../shared/http/app-error.js';
import type { DatosCurso } from './cursos.esquemas.js';
import type {
  ContextoLeccion,
  CursoDetalle,
  CursoResumen,
  DecisionRevision,
} from './cursos.modelo.js';
import {
  detallePrivado,
  detallePrivadoService,
  prevalidarPdfCurso,
} from './detalle-privado.service.js';
import { fichaRepository } from './ficha.repository.js';
import {
  MENSAJE_CONSULTAR_CURSO,
  MENSAJES,
  politicaCurso,
} from './politica-curso.js';
import { temarioService } from './temario/temario.service.js';

export interface ServicioCursos {
  // Para modules/contenido (CONTRATOS_SERVICIO §2.1)
  verificarCarga(idLeccion: number, usuario: UsuarioSesion): Promise<void>;
  conLeccionEditable<T>(
    idLeccion: number,
    usuario: UsuarioSesion,
    trabajo: (contexto: ContextoLeccion, cliente: PoolClient) => Promise<T>,
  ): Promise<T>;
  asociarPdfPrincipal(cliente: PoolClient, contexto: ContextoLeccion, archivoId: number): Promise<void>;
  detallePrivado(
    cliente: PoolClient,
    idCurso: number,
    prevalidados?: ReadonlySet<string>,
  ): Promise<CursoDetalle>;
  prevalidarPdfDeLeccion(idLeccion: number): Promise<ReadonlySet<string>>;
  autorizarLectura(idLeccion: number, idCursoArchivo: number, usuario: UsuarioSesion): Promise<void>;

  // Para modules/revision (CONTRATOS_SERVICIO §2.1)
  listarParaRevision(usuario: UsuarioSesion): Promise<{ items: CursoResumen[] }>;
  detalleParaRevision(idCurso: number, usuario: UsuarioSesion): Promise<CursoDetalle>;
  decidirRevision(idCurso: number, decision: DecisionRevision, usuario: UsuarioSesion): Promise<CursoDetalle>;
}

export const cursosService = {
  ...detallePrivadoService,
  ...temarioService,

  async listarMisCursos(usuario: UsuarioSesion): Promise<{ items: CursoResumen[] }> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const items = await fichaRepository.listarDelDocente(usuario.idPersona);
    return { items };
  },

  async obtenerMiCurso(id: number, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarPdfCurso(id);
    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, id);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirPropietario(base, usuario, MENSAJE_CONSULTAR_CURSO);
      return detallePrivado(cliente, id, prevalidados);
    });
  },

  async crearCurso(datos: DatosCurso, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    return enTransaccion(async (cliente) => {
      const idDocente = await fichaRepository.docentePorPersona(cliente, usuario.idPersona);
      if (idDocente === null) {
        throw AppError.sinPermiso('No tienes un perfil docente activo.');
      }

      const categoriaActiva = await fichaRepository.categoriaActiva(cliente, datos.categoriaId);
      if (!categoriaActiva) {
        throw AppError.solicitudInvalida('Selecciona una categoría existente y activa.', [
          {
            campo: 'categoriaId',
            mensaje: 'La categoría no existe o está inactiva.',
          },
        ]);
      }

      const idCurso = await fichaRepository.crearBorrador(cliente, idDocente, datos);
      return detallePrivado(cliente, idCurso);
    });
  },

  async actualizarMiCurso(
    idCurso: number,
    datos: DatosCurso,
    usuario: UsuarioSesion,
  ): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    const prevalidados = await prevalidarPdfCurso(idCurso);
    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirEditable(base, usuario, MENSAJES.actualizarCurso);

      const categoriaValida = await fichaRepository.categoriaActiva(cliente, datos.categoriaId);
      if (!categoriaValida) {
        throw AppError.solicitudInvalida('Selecciona una categoría activa.', [
          {
            campo: 'categoriaId',
            mensaje: 'La categoría no existe o está inactiva.',
          },
        ]);
      }

      await fichaRepository.actualizarCurso(cliente, idCurso, datos);
      return detallePrivado(cliente, idCurso, prevalidados);
    });
  },

  async enviarCursoARevision(idCurso: number, usuario: UsuarioSesion): Promise<CursoDetalle> {
    politicaCurso.exigirRol(usuario, 'DOCENTE');
    // Prevalida los PDF en disco fuera del bloqueo FOR UPDATE (R4/A5).
    const prevalidados = await prevalidarPdfCurso(idCurso);

    return enTransaccion(async (cliente) => {
      const base = await fichaRepository.base(cliente, idCurso, true);
      if (!base) {
        throw AppError.noEncontrado('Curso no disponible.');
      }
      politicaCurso.exigirTransicion(base, usuario, 'EN_REVISION', MENSAJES.enviarARevision);

      const detalle = await detallePrivado(cliente, idCurso, prevalidados);
      if (!detalle.validacion.completo) {
        throw AppError.solicitudInvalida(
          'El curso todavía está incompleto.',
          detalle.validacion.problemas,
        );
      }

      const actualizado = await fichaRepository.enviarARevision(cliente, idCurso);
      if (!actualizado) {
        throw AppError.conflicto('No se pudo enviar el curso a revisión.');
      }

      return detallePrivado(cliente, idCurso, prevalidados);
    });
  },
};

export const cursosApi: ServicioCursos = cursosService;