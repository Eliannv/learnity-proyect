import { Component, DestroyRef, ElementRef, ViewEncapsulation, afterNextRender, inject, input, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/**
 * Fila horizontal de tarjetas con flechas (escritorio) y deslizamiento (teléfono).
 * Cada elemento proyectado ocupa una columna: `columnas` en escritorio, 3 en tableta
 * y casi todo el ancho en teléfono para que se note que hay más a la derecha.
 */
@Component({
  selector: 'app-carrusel',
  imports: [LucideAngularModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="carrusel" [style.--carrusel-cols]="columnas()" [style.--carrusel-cols-tableta]="columnasTableta()">
      <div #pista class="carrusel-pista" role="list" [attr.aria-label]="etiqueta()" (scroll)="medir()">
        <ng-content />
      </div>
      @if (!alInicio()) {
        <button type="button" class="carrusel-flecha anterior" (click)="mover(-1)" aria-label="Ver anteriores">
          <lucide-icon name="chevron-left" [size]="22" />
        </button>
      }
      @if (!alFinal()) {
        <button type="button" class="carrusel-flecha siguiente" (click)="mover(1)" aria-label="Ver más">
          <lucide-icon name="chevron-right" [size]="22" />
        </button>
      }
    </div>
  `,
  styles: `
    app-carrusel {
      display: block;
    }
    .carrusel {
      --carrusel-gap: 16px;
      position: relative;
    }
    .carrusel-pista {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: calc((100% - (var(--carrusel-cols) - 1) * var(--carrusel-gap)) / var(--carrusel-cols));
      gap: var(--carrusel-gap);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      padding: 4px 0 12px;
      &::-webkit-scrollbar {
        display: none;
      }
      > * {
        scroll-snap-align: start;
        min-width: 0;
      }
    }
    .carrusel-flecha {
      position: absolute;
      top: calc(50% - 26px);
      z-index: 2;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 1px solid var(--gris-200);
      border-radius: 50%;
      background: var(--blanco);
      color: var(--tinta-900);
      box-shadow: 0 4px 14px rgb(15 23 42 / 14%);
      transition: background-color 0.15s;
      &:hover {
        background: var(--azul-050);
      }
      &.anterior {
        left: -22px;
      }
      &.siguiente {
        right: -22px;
      }
    }
    @media (max-width: 1100px) {
      .carrusel-pista {
        grid-auto-columns: calc(
          (100% - (var(--carrusel-cols-tableta) - 1) * var(--carrusel-gap)) / var(--carrusel-cols-tableta)
        );
      }
      .carrusel-flecha.anterior {
        left: -12px;
      }
      .carrusel-flecha.siguiente {
        right: -12px;
      }
    }
    @media (max-width: 900px) {
      .carrusel {
        --carrusel-gap: 12px;
      }
      .carrusel-pista {
        grid-auto-columns: 78%;
      }
      .carrusel-flecha {
        display: none;
      }
    }
  `,
})
export class Carrusel {
  readonly columnas = input(5);
  readonly columnasTableta = input(3);
  readonly etiqueta = input<string>();

  private readonly pista = viewChild.required<ElementRef<HTMLElement>>('pista');
  protected readonly alInicio = signal(true);
  protected readonly alFinal = signal(true);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.medir();
      const observador = new ResizeObserver(() => this.medir());
      observador.observe(this.pista().nativeElement);
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  protected medir() {
    const el = this.pista().nativeElement;
    this.alInicio.set(el.scrollLeft <= 2);
    this.alFinal.set(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  protected mover(sentido: 1 | -1) {
    const el = this.pista().nativeElement;
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: sentido * el.clientWidth, behavior: reducido ? 'auto' : 'smooth' });
  }
}
