import { Component, computed, input } from '@angular/core';

/**
 * Puntuación de 0 a 5 con estrellas parciales (solo lectura). Los lectores de pantalla
 * oyen «4,5 de 5 estrellas»; las estrellas dibujadas son decorativas.
 */
@Component({
  selector: 'app-estrellas',
  host: { role: 'img', '[attr.aria-label]': 'etiqueta()' },
  template: `
    <span class="fondo" aria-hidden="true">★★★★★</span>
    <span class="relleno" aria-hidden="true" [style.width.%]="porcentaje()">★★★★★</span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      line-height: 1;
      letter-spacing: 1px;
      white-space: nowrap;
    }
    .fondo { color: var(--gris-200); }
    .relleno {
      position: absolute;
      inset: 0 auto 0 0;
      overflow: hidden;
      color: #b4690e;
    }
  `,
})
export class Estrellas {
  readonly valor = input(0);

  protected readonly porcentaje = computed(() => Math.max(0, Math.min(5, this.valor())) * 20);
  protected readonly etiqueta = computed(
    () => `${this.valor().toLocaleString('es', { maximumFractionDigits: 1 })} de 5 estrellas`,
  );
}
