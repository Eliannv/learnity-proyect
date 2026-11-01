import type { DetalleAprendizaje } from '../../core/api/contrato';

export const CURSO_SIN_LECCIONES =
  'Este curso todavía no tiene lecciones disponibles para estudiar. Inténtalo más tarde o consulta al docente.';

export function leccionParaContinuar(
  detalle: DetalleAprendizaje,
): number | null {
  const lecciones = detalle.modulos.flatMap((modulo) => modulo.lecciones);

  const ultima = lecciones.find(
    (leccion) => leccion.id === detalle.inscripcion.ultimaLeccionId,
  );

  return ultima?.id
    ?? lecciones.find((leccion) => !leccion.progreso.completada)?.id
    ?? lecciones[0]?.id
    ?? null;
}