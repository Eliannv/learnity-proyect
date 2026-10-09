import { Component, computed, input } from '@angular/core';

/** Anillo de avance (por ejemplo, lecciones vistas de las totales). */
@Component({
  selector: 'app-anillo-progreso',
  template: `
    <svg [attr.width]="tamano()" [attr.height]="tamano()" viewBox="0 0 100 100" role="img" [attr.aria-label]="etiqueta()">
      <circle class="fondo" cx="50" cy="50" r="42" />
      <circle class="avance" cx="50" cy="50" r="42" [attr.stroke-dasharray]="circunferencia" [attr.stroke-dashoffset]="desfase()" />
    </svg>
    <span class="centro" aria-hidden="true">
      <strong>{{ porcentaje() }}%</strong>
    </span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
    }
    svg {
      transform: rotate(-90deg);
    }
    circle {
      fill: none;
      stroke-width: 10;
    }
    .fondo {
      stroke: var(--azul-100);
    }
    .avance {
      stroke: var(--azul-700);
      stroke-linecap: round;
      transition: stroke-dashoffset 0.6s ease-out;
    }
    .centro {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      strong {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .avance {
        transition: none;
      }
    }
  `,
})
export class AnilloProgreso {
  readonly valor = input.required<number>();
  readonly total = input.required<number>();
  readonly tamano = input(96);
  readonly etiqueta = input('');

  protected readonly circunferencia = 2 * Math.PI * 42;
  protected readonly porcentaje = computed(() => (this.total() ? Math.round((this.valor() / this.total()) * 100) : 0));
  protected readonly desfase = computed(() => this.circunferencia * (1 - this.porcentaje() / 100));
}
