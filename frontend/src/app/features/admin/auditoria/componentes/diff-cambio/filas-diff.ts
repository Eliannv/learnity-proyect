import type { DetalleCambioAuditoria } from '../../../../../core/api/contrato';

/** Una columna del registro con su valor antes y después del cambio. */
export interface FilaDiff {
  columna: string;
  /** Texto del valor anterior; null si no había (INSERT) o no se registró. */
  antes: string | null;
  despues: string | null;
  /** La columna cambió en este registro (o, en INSERT/DELETE, tiene valor). */
  cambio: boolean;
  /** La auditoría guarda que cambió, pero no su valor (contrasena_hash, token_hash, archivo.ruta). */
  sinValor: boolean;
}

/** Valor de una columna como texto legible: null se muestra como «null» y los objetos como JSON. */
export function textoValor(valor: unknown): string {
  if (valor === null) return 'null';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

const tiene = (fila: Record<string, unknown> | null, columna: string) => !!fila && Object.hasOwn(fila, columna);

/**
 * Filas de la tabla «Datos antes y después», en el orden de las columnas del registro. En UPDATE marca las de
 * `columnasCambiadas`; en INSERT todas son nuevas y en DELETE todas se borran.
 */
export function filasDiff(d: Pick<DetalleCambioAuditoria, 'operacion' | 'antes' | 'despues' | 'columnasCambiadas'>): FilaDiff[] {
  const cambiadas = new Set(d.columnasCambiadas ?? []);
  const columnas = [...new Set([...Object.keys(d.antes ?? {}), ...Object.keys(d.despues ?? {}), ...cambiadas])];
  return columnas.map((columna) => {
    const sinValor = !tiene(d.antes, columna) && !tiene(d.despues, columna);
    return {
      columna,
      antes: tiene(d.antes, columna) ? textoValor(d.antes![columna]) : null,
      despues: tiene(d.despues, columna) ? textoValor(d.despues![columna]) : null,
      cambio: d.operacion === 'UPDATE' ? cambiadas.has(columna) : true,
      sinValor,
    };
  });
}
