import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** Tarjeta de indicador (StatTile): etiqueta, valor grande y nota. */
@Component({
  selector: 'app-indicador',
  imports: [LucideAngularModule],
  template: `
    <div class="indicador">
      <div class="cabecera">
        <span class="etiqueta">{{ etiqueta() }}</span>
        @if (icono()) {
          <lucide-icon [name]="icono()!" [size]="20" />
        }
      </div>
      <strong class="valor">{{ valor() }}</strong>
      @if (nota()) {
        <span class="nota">{{ nota() }}</span>
      }
    </div>
  `,
  styles: `
    .indicador {
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      padding: 22px 24px;
      border-radius: var(--radio-md);
      background: var(--azul-050);
    }
    .cabecera {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--azul-700);
    }
    .etiqueta {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.12em;
      color: var(--gris-500);
    }
    .valor {
      font-size: 34px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .nota {
      font-size: 14px;
      color: var(--gris-500);
    }
    @media (max-width: 900px) {
      .indicador {
        padding: 18px 20px;
      }
      .valor {
        font-size: 28px;
      }
    }
  `,
})
export class Indicador {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string>();
  readonly nota = input<string>();
  readonly icono = input<string>();
}
