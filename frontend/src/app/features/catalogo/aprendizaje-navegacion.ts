import type { DetalleAprendizaje, LeccionAprendizaje } from '../../core/api/contrato';

/** Solo se navega a una lección realmente incluida en el temario autorizado. */
export function leccionParaContinuar(detalle: DetalleAprendizaje): LeccionAprendizaje | null {
  const lecciones = detalle.modulos.flatMap((modulo) => modulo.lecciones);
  return lecciones.find((leccion) => leccion.id === detalle.inscripcion.ultimaLeccionId)
    ?? lecciones.find((leccion) => !leccion.progreso.completada)
    ?? lecciones[0]
    ?? null;
}
