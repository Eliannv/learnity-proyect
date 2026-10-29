import { Injectable, signal } from '@angular/core';

export interface PeticionConfirmacion {
  titulo: string;
  mensaje: string;
  /** Texto del botón que confirma: el verbo de la acción («Eliminar módulo»), nunca «Aceptar». */
  accion: string;
  /** Acción destructiva: el botón se pinta en rojo. */
  peligro?: boolean;
  icono?: string;
}

interface Pendiente extends PeticionConfirmacion {
  resolver(respuesta: boolean): void;
}

/**
 * Sustituye a `window.confirm()`: abre un modal accesible y resuelve `true` solo si la persona confirma.
 * Lo muestra `<app-confirmacion>` en la raíz. Una nueva petición cancela la anterior.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  readonly actual = signal<Pendiente | null>(null);

  confirmar(peticion: PeticionConfirmacion): Promise<boolean> {
    this.actual()?.resolver(false);
    return new Promise((resolver) => this.actual.set({ ...peticion, resolver }));
  }

  responder(respuesta: boolean): void {
    const pendiente = this.actual();
    this.actual.set(null);
    pendiente?.resolver(respuesta);
  }
}
