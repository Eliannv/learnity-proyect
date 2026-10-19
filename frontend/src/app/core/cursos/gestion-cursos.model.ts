import type { EstadoCurso } from '../api/contrato';

// Los tipos de la API salen de `core/api/contrato.ts` (generado desde el contrato).
export type {
  ArchivoPdf,
  CursoDetalle,
  CursoResumen,
  DatosCurso,
  DatosLeccion,
  DatosModulo,
  DecisionRevision,
  EstadoCurso,
  LeccionPrivada,
  ModuloPrivado,
  NivelCurso,
} from '../api/contrato';

export function esEditable(estado: EstadoCurso): boolean {
  return estado === 'BORRADOR' || estado === 'RECHAZADO';
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