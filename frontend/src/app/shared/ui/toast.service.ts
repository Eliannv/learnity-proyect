import { Injectable, signal } from '@angular/core';

export type TipoToast = 'exito' | 'error' | 'info';

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

const DURACION: Record<TipoToast, number> = { exito: 4000, info: 5000, error: 7000 };
const MAXIMO = 4;

/**
 * Avisos emergentes de toda la app («Curso guardado», «Error de conexión»).
 * Los muestra `<app-toasts>` en la raíz; cada aviso se cierra solo o con su botón.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguiente = 0;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();
  readonly avisos = signal<Toast[]>([]);

  exito(mensaje: string): void { this.mostrar('exito', mensaje); }
  error(mensaje: string): void { this.mostrar('error', mensaje); }
  info(mensaje: string): void { this.mostrar('info', mensaje); }

  cerrar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
    this.temporizadores.delete(id);
    this.avisos.update((lista) => lista.filter((t) => t.id !== id));
  }

  private mostrar(tipo: TipoToast, mensaje: string): void {
    const id = ++this.siguiente;
    // Un mismo aviso repetido no se apila: se renueva.
    const repetido = this.avisos().find((t) => t.tipo === tipo && t.mensaje === mensaje);
    if (repetido) this.cerrar(repetido.id);
    this.avisos.update((lista) => [...lista, { id, tipo, mensaje }].slice(-MAXIMO));
    this.temporizadores.set(id, setTimeout(() => this.cerrar(id), DURACION[tipo]));
  }
}
