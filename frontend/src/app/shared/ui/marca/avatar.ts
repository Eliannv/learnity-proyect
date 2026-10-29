import { Component, effect, input, signal } from '@angular/core';

/**
 * Foto de perfil o, si no hay (o no carga), círculo con iniciales.
 * `solido`: azul con texto blanco; por defecto, azul claro (azul-800 sobre azul-100: 5,5:1, AA).
 * La imagen es decorativa (`alt=""`): el nombre siempre aparece junto al avatar.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (imagen() && !fallida()) {
      <img class="avatar foto" [src]="imagen()" alt="" [style.--t.px]="tamano()" [width]="tamano()" [height]="tamano()"
        loading="lazy" (error)="fallida.set(true)" />
    } @else {
      <span class="avatar" [class.solido]="solido()" [style.--t.px]="tamano()">{{ texto() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    .avatar {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      width: var(--t);
      height: var(--t);
      border-radius: 50%;
      background: var(--azul-100);
      color: var(--azul-800);
      font-weight: 600;
      font-size: calc(var(--t) * 0.38);
    }
    .foto { object-fit: cover; background: var(--gris-100); }
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
  /** URL de la foto de perfil; null muestra las iniciales. */
  readonly imagen = input<string | null | undefined>(null);

  protected readonly fallida = signal(false);

  constructor() {
    // Una foto nueva vuelve a intentarse aunque la anterior no cargara.
    effect(() => {
      this.imagen();
      this.fallida.set(false);
    });
  }
}
