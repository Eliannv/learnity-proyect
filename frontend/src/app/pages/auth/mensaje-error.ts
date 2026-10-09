import { HttpErrorResponse } from '@angular/common/http';

/** Convierte un error de la API en un mensaje entendible para el usuario. */
export function mensajeDeError(error: unknown, accion: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status === 504) {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté encendido (npm run dev).';
    }
    if (error.status === 501) {
      return `${accion} se habilita al terminar el Sprint 1. Mientras tanto, usa los accesos de demostración.`;
    }
    const mensaje = (error.error as { error?: { mensaje?: string } } | null)?.error?.mensaje;
    if (mensaje) return mensaje;
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
