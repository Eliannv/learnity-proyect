import { HttpErrorResponse } from '@angular/common/http';
import { inject, signal } from '@angular/core';

import { ToastService } from '../../shared/ui/retroalimentacion/toast.service';
import { erroresPorCampo } from '../http/error-api';

/** Toasts de la app si la petición se crea en un componente; fuera de inyección (pruebas puras), ninguno. */
function toastsDisponibles(): ToastService | null {
  try {
    return inject(ToastService, { optional: true });
  } catch {
    return null;
  }
}

/**
 * Estado de una petición de pantalla. Los éxitos se anuncian como toast (si hay toasts) y los errores
 * se quedan junto al formulario, con sus campos; la falta de conexión se anuncia también como toast.
 */
export class Peticion {
  private version = 0;
  private readonly toasts = toastsDisponibles();

  readonly ocupada = signal(false);
  readonly error = signal('');
  readonly exito = signal('');
  readonly campos = signal<Record<string, string>>({});
  readonly requiereRecarga = signal(false);

  campo(nombre: string): string {
    return Object.entries(this.campos())
      .filter(
        ([clave]) =>
          clave === nombre || clave.startsWith(nombre + '.'),
      )
      .map(([, mensaje]) => mensaje)
      .join(' ');
  }

  limpiar(): void {
    this.version++;

    this.ocupada.set(false);
    this.error.set('');
    this.exito.set('');
    this.campos.set({});
    this.requiereRecarga.set(false);
  }

  fallar(error: unknown): void {
    this.exito.set('');
    this.campos.set(erroresPorCampo(error));

    const http =
      error instanceof HttpErrorResponse ? error : null;

    const cuerpo = http?.error?.error;

    this.requiereRecarga.set(
      !!http && [403, 404, 409].includes(http.status),
    );

    if (http?.status === 0) {
      this.toasts?.error('Sin conexión con el servidor. Revisa tu conexión y vuelve a intentarlo.');
    }

    this.error.set(
      http?.status === 0
        ? 'No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.'
        : http?.status === 501 ||
            (
              http?.status === 404 &&
              /^La ruta /.test(cuerpo?.mensaje ?? '')
            )
          ? 'Esta operación todavía no está disponible en el servidor.'
          : http?.status === 403
            ? 'No tienes permiso para acceder a este contenido.'
            : http?.status === 413
              ? 'El PDF supera el máximo permitido de 10 MB.'
              : cuerpo?.mensaje ??
                'No se pudo completar la operación. Vuelve a intentarlo.',
    );
  }

  async ejecutar<T>(
    tarea: () => Promise<T>,
    aplicar: (dato: T) => void,
    mensaje = '',
  ): Promise<void> {
    if (this.ocupada()) return;

    this.limpiar();

    const version = this.version;

    this.ocupada.set(true);

    try {
      const dato = await tarea();

      if (version !== this.version) return;

      aplicar(dato);

      if (version === this.version && mensaje) {
        if (this.toasts) this.toasts.exito(mensaje);
        else this.exito.set(mensaje);
      }
    } catch (error) {
      if (version === this.version) {
        this.fallar(error);
      }
    } finally {
      if (version === this.version) {
        this.ocupada.set(false);
      }
    }
  }
}