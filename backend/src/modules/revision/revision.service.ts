import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { env } from '../../shared/config/env.js';
import { notificar } from '../../shared/correo/plantilla.js';
import { cursosApi, type DecisionRevision } from '../cursos/index.js';
import { correoCursoAprobado, correoCursoRechazado } from './revision.correos.js';

export const revisionService = {
  listar: (usuario: UsuarioSesion) => cursosApi.listarParaRevision(usuario),
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
