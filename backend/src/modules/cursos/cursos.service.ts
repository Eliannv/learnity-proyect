import { AppError } from '../../shared/http/app-error.js';
import { cursosRepository, type CursoFila, type FiltrosPublicos, type LeccionFila } from './cursos.repository.js';

function cursoPublico(fila: CursoFila) {
  return {
    id: fila.id,
    titulo: fila.titulo,
    subtitulo: fila.subtitulo,
    categoria: { id: fila.categoriaId, nombre: fila.categoriaNombre },
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

function ordenarTemario(filas: LeccionFila[]) {
  const modulos: { id: number; orden: number; titulo: string; lecciones: {
    id: number; orden: number; titulo: string; tipo: NonNullable<LeccionFila['tipo']>; minutos: number;
  }[] }[] = [];
  for (const fila of filas) {
    let modulo = modulos.at(-1);
    if (modulo?.id !== fila.moduloId) {
      modulo = { id: fila.moduloId, orden: fila.moduloOrden, titulo: fila.moduloTitulo, lecciones: [] };
      modulos.push(modulo);
    }
    if (fila.id !== null && fila.orden !== null && fila.titulo !== null && fila.tipo !== null) {
      modulo.lecciones.push({
        id: fila.id, orden: fila.orden, titulo: fila.titulo, tipo: fila.tipo,
        minutos: Math.round((fila.segundos ?? 0) / 60),
      });
    }
  }
  return modulos;
}

export const cursosService = {
  categoriasPublicas: () => cursosRepository.categoriasPublicas(),

  async catalogoPublico(filtros: FiltrosPublicos) {
    const { filas, total } = await cursosRepository.catalogoPublico(filtros);
    return {
      items: filas.map(cursoPublico),
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite),
    };
  },

  async detallePublico(id: number) {
    const fila = await cursosRepository.detallePublico(id);
    if (!fila) throw AppError.noEncontrado('Curso no disponible.');
    const temario = await cursosRepository.temarioPublico(id);
    return {
      ...cursoPublico(fila),
      descripcion: fila.descripcion,
      docenteBio: fila.docenteBio,
      objetivos: fila.objetivos,
      requisitos: fila.requisitos,
      temario: ordenarTemario(temario),
    };
  },
};
