import { Component, input } from '@angular/core';

/** Tarjeta de indicador (StatTile): etiqueta, valor grande y nota. */
@Component({
  selector: 'app-indicador',
  template: `
    <div class="indicador">
      <span class="etiqueta">{{ etiqueta() }}</span>
      <strong class="valor num">{{ valor() }}</strong>
      @if (nota()) {
        <span class="nota">{{ nota() }}</span>
      }
    </div>
  `,
  styles: `
    /* KPI como tipografía: superficie blanca con borde, etiqueta pequeña en minúscula de frase y la cifra grande. */
    .indicador {
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      padding: 16px 20px;
      border: 1px solid var(--borde);
      border-radius: var(--radio);
      background: var(--superficie);
    }
    .etiqueta {
      font-size: 13px;
      font-weight: 500;
      color: var(--tinta-3);
    }
    .valor {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: var(--tinta);
    }
    .nota {
      font-size: 13px;
      color: var(--tinta-2);
    }
    @media (max-width: 900px) {
      .indicador {
        padding: 14px 16px;
      }
      .valor {
        font-size: 24px;
      }
    }
  `,
})
export class Indicador {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string>();
  readonly nota = input<string>();
  /** Ya no se dibuja (el KPI es solo tipografía); se conserva mientras se migran las vistas que lo pasan. */
  readonly icono = input<string>();
}
