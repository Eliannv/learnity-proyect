import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { env } from '../../shared/config/env.js';
import { notificar } from '../../shared/correo/plantilla.js';
import { registrarEvento } from '../../shared/log/registro.js';
import { cursosApi, type DecisionRevision, type EstadoRevision } from '../cursos/index.js';
import {
  correoCursoAprobado, correoCursoReactivado, correoCursoRechazado, correoCursoSuspendido,
} from './revision.correos.js';
import type { SuspensionCursoDto } from './revision.esquemas.js';

export const revisionService = {
  listar: (usuario: UsuarioSesion, estado: EstadoRevision) => cursosApi.listarParaRevision(usuario, estado),

  /** Suspende un curso publicado y avisa al docente con el motivo (sin esperar el envío). */
  async suspender(id: number, datos: SuspensionCursoDto, usuario: UsuarioSesion) {
    const curso = await cursosApi.suspender(id, datos.motivo, usuario);
    registrarEvento('curso_suspendido', { idCurso: id, idAdmin: usuario.idUsuario });
    const docente = await cursosApi.contactoDocente(id);
    if (docente) {
      notificar('revision_curso', correoCursoSuspendido({
        para: docente.correo, nombres: docente.nombres, titulo: curso.titulo, motivo: datos.motivo,
        enlace: `${env.FRONTEND_URL}/docente/cursos`,
      }));
    }
    return curso;
  },

  /** Reactiva un curso suspendido y avisa al docente. */
  async reactivar(id: number, usuario: UsuarioSesion) {
    const curso = await cursosApi.reactivar(id, usuario);
    registrarEvento('curso_reactivado', { idCurso: id, idAdmin: usuario.idUsuario });
    const docente = await cursosApi.contactoDocente(id);
    if (docente) {
      notificar('revision_curso', correoCursoReactivado({
        para: docente.correo, nombres: docente.nombres, titulo: curso.titulo, enlace: `${env.FRONTEND_URL}/cursos/${id}`,
      }));
    }
    return curso;
  },
  detalle: (id: number, usuario: UsuarioSesion) => cursosApi.detalleParaRevision(id, usuario),

  /** Tras confirmar la decisión, avisa al docente por correo (sin esperar el envío). */
  async decidir(id: number, datos: DecisionRevision, usuario: UsuarioSesion) {
    const curso = await cursosApi.decidirRevision(id, datos, usuario);
    const docente = await cursosApi.contactoDocente(id);
    if (docente) {
      const comun = { para: docente.correo, nombres: docente.nombres, titulo: curso.titulo };
      notificar('revision_curso', datos.decision === 'APROBAR'
        ? correoCursoAprobado({ ...comun, enlace: `${env.FRONTEND_URL}/cursos/${id}` })
        : correoCursoRechazado({ ...comun, motivo: datos.motivo.trim(), enlace: `${env.FRONTEND_URL}/docente/cursos/${id}/editar` }));
    }
    return curso;
  },
};
