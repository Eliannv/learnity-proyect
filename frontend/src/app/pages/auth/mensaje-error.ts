import { HttpErrorResponse } from '@angular/common/http';

interface ErrorApi {
  error?: { codigo?: string; mensaje?: string; detalles?: { campo?: string; mensaje?: string }[] | unknown };
}

/** Convierte un error de la API en un mensaje entendible para el usuario. */
export function mensajeDeError(error: unknown, accion: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status === 502 || error.status === 504) {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté encendido (npm run dev).';
    }
    if (error.status === 429) {
      return 'Hiciste demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
    }
    const cuerpo = (error.error as ErrorApi | null)?.error;
    // Errores de validación: el detalle del campo explica mejor que "Revisa los datos enviados".
    const detalles = Array.isArray(cuerpo?.detalles) ? (cuerpo.detalles as { mensaje?: string }[]) : [];
    if (cuerpo?.codigo === 'SOLICITUD_INVALIDA' && detalles[0]?.mensaje) return detalles[0].mensaje;
    if (cuerpo?.mensaje) return cuerpo.mensaje;
  }
  return `${accion} no se pudo completar. Inténtalo de nuevo.`;
}

/** Errores de la API por campo (detalles: [{ campo, mensaje }]). */
export function erroresPorCampo(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse)) return {};
  const detalles = (error.error as ErrorApi | null)?.error?.detalles;
  if (!Array.isArray(detalles)) return {};
  return Object.fromEntries(
    (detalles as { campo?: string; mensaje?: string }[]).filter((d) => d.campo && d.mensaje).map((d) => [d.campo!, d.mensaje!]),
  );
}
