import type { PoolClient } from 'pg';

/**
 * Puerto que `cursos` define y `contenido` implementa (ADR-004).
 * Rompe la dependencia circular `cursos` ↔ `contenido` sin sacar la tabla `archivo` de Contenido.
 */
export interface LiberadorArchivos {
  /** Dentro de la transacción de borrado, con el curso bloqueado: retira los PDF que hayan quedado sin referencia. */
  retirarSinUso(cliente: PoolClient, idCurso: number, idsArchivos: number[]): Promise<void>;
  /** Después del COMMIT: intenta borrar del disco los archivos ya retirados. No lanza si el disco falla. */
  ejecutarPendientes(): Promise<void>;
}

let liberadorArchivos: LiberadorArchivos | null = null;

export function registrarLiberadorArchivos(liberador: LiberadorArchivos): void {
  liberadorArchivos = liberador;
}

export function obtenerLiberadorArchivos(): LiberadorArchivos | null {
  return liberadorArchivos;
}
