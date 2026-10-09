import { Component, input } from '@angular/core';

@Component({
  selector: 'app-barra-progreso',
  template: `
    <div class="barra" role="progressbar" [attr.aria-valuenow]="valor()" aria-valuemin="0" aria-valuemax="100">
      <span [style.width.%]="valor()" [class.verde]="verde()"></span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .barra {
      height: 6px;
      border-radius: 999px;
      background: var(--gris-200);
      overflow: hidden;
    }
    span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--azul-700);
    }
    .verde {
      background: var(--verde-600);
    }
  `,
})
export class BarraProgreso {
  readonly valor = input(0);
  readonly verde = input(false);
}
