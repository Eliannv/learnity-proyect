import { HttpErrorResponse } from '@angular/common/http';

export interface DetalleErrorApi {
  readonly campo?: string;
  readonly mensaje: string;
}

export interface ErrorApi {
  readonly codigo?: string;
  readonly mensaje?: string;
  readonly detalles: readonly DetalleErrorApi[];
  readonly estadoHttp: number;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Extrae el error público de la API sin confiar en la forma de una respuesta fallida. */
export function convertirErrorApi(error: unknown): ErrorApi | null {
  if (!(error instanceof HttpErrorResponse) || !esRegistro(error.error)) return null;
  const cuerpo = error.error['error'];
  if (!esRegistro(cuerpo)) return null;

  const detalles = Array.isArray(cuerpo['detalles'])
    ? cuerpo['detalles'].filter(
        (detalle): detalle is DetalleErrorApi =>
          esRegistro(detalle) &&
          typeof detalle['mensaje'] === 'string' &&
          detalle['mensaje'].length > 0 &&
          (detalle['campo'] === undefined || typeof detalle['campo'] === 'string'),
      )
    : [];

  return {
    estadoHttp: error.status,
    codigo: typeof cuerpo['codigo'] === 'string' ? cuerpo['codigo'] : undefined,
    mensaje: typeof cuerpo['mensaje'] === 'string' ? cuerpo['mensaje'] : undefined,
    detalles,
  };
}

/** Conserva los mensajes visibles actuales y prioriza el detalle de validación. */
export function mensajeDeError(error: unknown, accion: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status === 502 || error.status === 504) {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté encendido (npm run dev).';
    }
    if (error.status === 429) {
      return 'Hiciste demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
    }
    const cuerpo = convertirErrorApi(error);
    if (cuerpo?.codigo === 'SOLICITUD_INVALIDA' && cuerpo.detalles[0]?.mensaje) {
      return cuerpo.detalles[0].mensaje;
    }
    if (cuerpo?.mensaje) return cuerpo.mensaje;
  }
  return `${accion} no se pudo completar. Inténtalo de nuevo.`;
}

/** Devuelve los mensajes de validación que sí identifican un campo. */
export function erroresPorCampo(error: unknown): Record<string, string> {
  const detalles = convertirErrorApi(error)?.detalles ?? [];
  return Object.fromEntries(
    detalles.filter((detalle) => detalle.campo).map((detalle) => [detalle.campo!, detalle.mensaje]),
  );
}
