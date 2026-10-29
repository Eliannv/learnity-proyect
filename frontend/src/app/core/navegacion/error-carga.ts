import { Injectable, signal } from '@angular/core';

/**
 * Mensajes con que los navegadores informan que no pudieron descargar un módulo de carga diferida:
 * pasa si el servidor se reinició o se desplegó otra versión mientras la pestaña estaba abierta,
 * o si se perdió la conexión. Sin manejarlo, la sección queda en blanco y no se avisa de nada.
 */
const PATRONES = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
];

export function esErrorDeCarga(error: unknown): boolean {
  const texto = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return PATRONES.some((patron) => patron.test(texto));
}

/** Sección que no se pudo cargar; la muestra `<app-error-carga>` hasta que la persona recarga o cierra. */
@Injectable({ providedIn: 'root' })
export class ErrorCargaService {
  readonly destino = signal<string | null>(null);

  fallo(url: string): void {
    this.destino.set(url);
  }

  cerrar(): void {
    this.destino.set(null);
  }
}
