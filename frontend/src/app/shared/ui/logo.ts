import { Component, input } from '@angular/core';

/** Marca de Learnity: birrete + nombre. `claro` se usa sobre fondos oscuros. */
@Component({
  selector: 'app-logo',
  template: `
    <span class="logo" [class.claro]="claro()" [style.font-size.px]="tamano()">
      <svg class="birrete" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3 1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"
        />
      </svg>
      @if (!soloIcono()) {
        <span class="nombre">Learnity</span>
      }
      @if (etiqueta()) {
        <span class="rol">{{ etiqueta() }}</span>
      }
    </span>
  `,
  styles: `
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      color: var(--tinta-900);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .birrete {
      width: 1.3em;
      height: 1.3em;
      fill: var(--azul-700);
    }
    .claro {
      color: var(--blanco);
      .birrete {
        fill: var(--blanco);
      }
    }
    .rol {
      margin-left: 0.4em;
      font-size: 0.5em;
      font-weight: 600;
      letter-spacing: 0.08em;
      opacity: 0.85;
    }
  `,
})
export class Logo {
  readonly tamano = input(24);
  readonly claro = input(false);
  readonly etiqueta = input<string>();
  /** Solo el birrete (riel cerrado del panel). */
  readonly soloIcono = input(false);
}
