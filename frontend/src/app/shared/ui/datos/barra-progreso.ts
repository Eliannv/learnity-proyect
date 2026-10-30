import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-barra-progreso',
  template: `
    <div class="barra" role="progressbar" [attr.aria-label]="etiqueta()" [attr.aria-valuenow]="valor()" aria-valuemin="0" aria-valuemax="100">
      <span [style.transform]="'scaleX(' + escala() + ')'" [class.verde]="verde()"></span>
    </div>
  `,
  styles: `
    /* Pista de 8px en el tinte del acento; el avance crece con transform (no con width), sin recalcular el diseño. */
    :host {
      display: block;
    }
    .barra {
      height: 8px;
      border-radius: 999px;
      background: var(--acento-pista);
      overflow: hidden;
    }
    span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--acento);
      transform-origin: left;
      transition: transform var(--t-hoja) var(--curva-salida);
    }
    .verde {
      background: var(--positivo);
    }
  `,
})
export class BarraProgreso {
  readonly valor = input(0);
  readonly verde = input(false);
  /** Nombre accesible de la barra (WCAG: un progressbar necesita nombre). */
  readonly etiqueta = input('Progreso del curso');

  protected readonly escala = computed(() => Math.max(0, Math.min(100, this.valor())) / 100);
}
