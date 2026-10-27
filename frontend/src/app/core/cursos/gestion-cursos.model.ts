import type { EstadoCurso } from '../api/contrato';

// Los tipos de la API salen de `core/api/contrato.ts` (generado desde el contrato).
export type {
  ArchivoPdf,
  CuestionarioDocente,
  CursoDetalle,
  DatosCuestionario,
  CursoResumen,
  DatosCurso,
  DatosLeccion,
  DatosModulo,
  DecisionRevision,
  EstadoCurso,
  LeccionPrivada,
  LetraOpcion,
  ModuloPrivado,
  NivelCurso,
} from '../api/contrato';

/** Un curso PUBLICADO se edita sin volver a revisión; EN_REVISION espera la decisión del administrador. */
export function esEditable(estado: EstadoCurso): boolean {
  return estado === 'BORRADOR' || estado === 'RECHAZADO' || estado === 'PUBLICADO';
}

export function siguienteOrden(
  items: { orden: number }[],
  maximo: number,
): number {
  return (
    Array.from({ length: maximo }, (_, i) => i + 1).find(
      (n) => !items.some((x) => x.orden === n),
    ) ?? 1
  );
}