import { Component, input } from '@angular/core';

/** Círculo con iniciales. `solido`: azul con texto blanco; por defecto, azul claro. */
@Component({
  selector: 'app-avatar',
  template: `<span class="avatar" [class.solido]="solido()" [style.--t.px]="tamano()">{{ texto() }}</span>`,
  styles: `
    .avatar {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: var(--t);
      height: var(--t);
      border-radius: 50%;
      background: var(--azul-100);
      color: var(--azul-700);
      font-weight: 600;
      font-size: calc(var(--t) * 0.38);
    }
    .solido {
      background: var(--azul-700);
      color: var(--blanco);
    }
  `,
})
export class Avatar {
  readonly texto = input.required<string>();
  readonly tamano = input(44);
  readonly solido = input(false);
}
