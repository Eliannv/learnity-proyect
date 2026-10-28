import { AppError } from '../../shared/http/app-error.js';
import type {
  CursoPublico,
  CursoPublicoDetalle,
  FiltrosPublicos,
  ModuloTemarioPublico,
} from './catalogo.modelo.js';
import {
  catalogoRepository,
  type CursoFila,
  type LeccionFila,
} from './catalogo.repository.js';

function cursoPublico(fila: CursoFila): CursoPublico {
  return {
    id: fila.id,
    titulo: fila.titulo,
    subtitulo: fila.subtitulo,
    categoria: {
      id: fila.categoriaId,
      nombre: fila.categoriaNombre,
    },
    docente: fila.docente,
    nivel: fila.nivel,
    portadaUrl: fila.portadaUrl,
    modulos: fila.modulos,
    lecciones: fila.lecciones,
    minutos: Math.round(fila.segundos / 60),
    publicadoEn: fila.publicadoEn.toISOString(),
    estado: 'PUBLICADO' as const,
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
      items: filas.map(cursoPublico),
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
    return {
      ...cursoPublico(fila),
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
