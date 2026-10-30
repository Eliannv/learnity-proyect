import { AppError } from '../../shared/http/app-error.js';
import { registrarEvento } from '../../shared/log/registro.js';
import type {
  CalificacionCurso,
  CursoPublico,
  CursoPublicoDetalle,
  FiltrosPublicos,
  ModuloTemarioPublico,
} from './catalogo.modelo.js';
import {
  catalogoRepository,
  type CursoFila,
  type CursoFilaCatalogo,
  type LeccionFila,
} from './catalogo.repository.js';

function cursoPublico(fila: CursoFila, calificacion: CalificacionCurso): CursoPublico {
  return {
    id: fila.id,
    titulo: fila.titulo,
    subtitulo: fila.subtitulo,
    categoria: {
      id: fila.categoriaId,
      nombre: fila.categoriaNombre,
      icono: fila.categoriaIcono,
    },
    docente: fila.docente,
    nivel: fila.nivel,
    portadaUrl: fila.portadaUrl,
    modulos: fila.modulos,
    lecciones: fila.lecciones,
    minutos: Math.round(fila.segundos / 60),
    publicadoEn: fila.publicadoEn.toISOString(),
    estado: 'PUBLICADO' as const,
    calificacion,
  };
}

function calificacionDeFila(fila: CursoFilaCatalogo): CalificacionCurso {
  return {
    promedio: fila.calificacionPromedio === null ? null : Number(fila.calificacionPromedio),
    total: fila.calificacionTotal,
  };
}

function ordenarTemario(filas: LeccionFila[]): ModuloTemarioPublico[] {
  const modulos: ModuloTemarioPublico[] = [];

  for (const fila of filas) {
    let modulo = modulos.at(-1);
    if (modulo?.id !== fila.moduloId) {
      modulo = {
        id: fila.moduloId,
        orden: fila.moduloOrden,
        titulo: fila.moduloTitulo,
        lecciones: [],
      };
      modulos.push(modulo);
    }

    if (
      fila.id !== null &&
      fila.orden !== null &&
      fila.titulo !== null &&
      fila.tipo !== null
    ) {
      modulo.lecciones.push({
        id: fila.id,
        orden: fila.orden,
        titulo: fila.titulo,
        tipo: fila.tipo,
        minutos: Math.round((fila.segundos ?? 0) / 60),
      });
    }
  }

  return modulos;
}

export const catalogoService = {
  categoriasPublicas: () => catalogoRepository.categoriasPublicas(),

  async catalogoPublico(filtros: FiltrosPublicos) {
    const { filas, total } = await catalogoRepository.catalogoPublico(filtros);
    return {
      items: filas.map((fila) => cursoPublico(fila, calificacionDeFila(fila))),
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite),
    };
  },

  async detallePublico(id: number): Promise<CursoPublicoDetalle> {
    const fila = await catalogoRepository.detallePublico(id);
    if (!fila) {
      throw AppError.noEncontrado('Curso no disponible.');
    }

    const [temario, instructor, calificacion] = await Promise.all([
      catalogoRepository.temarioPublico(id),
      catalogoRepository.instructorDeCurso(id),
      catalogoRepository.calificacion(id),
    ]);
    // Entre las dos lecturas el curso pudo dejar de estar publicado.
    if (!instructor) {
      throw AppError.noEncontrado('Curso no disponible.');
    }
    // La vista alimenta la tasa de conversión del docente; si falla, la ficha se sirve igual.
    await catalogoRepository.registrarVisita(id).catch((error: unknown) =>
      registrarEvento('visita_curso_fallida', { idCurso: id, error: error instanceof Error ? error.message : String(error) }, 'aviso'));
    return {
      ...cursoPublico(fila, calificacion),
      descripcion: fila.descripcion,
      docenteBio: fila.docenteBio,
      instructor,
      calificacion,
      objetivos: fila.objetivos,
      requisitos: fila.requisitos,
      temario: ordenarTemario(temario),
    };
  },
};
