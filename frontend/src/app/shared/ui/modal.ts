import { Component, DOCUMENT, ElementRef, OnDestroy, afterNextRender, inject, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/**
 * Ventana modal con fondo oscuro. Se cierra con la X, con Escape o al hacer clic fuera.
 * Al abrirse lleva el foco al diálogo, lo mantiene dentro con Tab y lo devuelve al elemento que la abrió.
 */
@Component({
  selector: 'app-modal',
  imports: [LucideAngularModule],
  host: {
    '(document:keydown.escape)': 'cerrar.emit()',
    '(keydown.tab)': 'atrapar($event)',
    '(keydown.shift.tab)': 'atrapar($event)',
  },
  template: `
    <div class="fondo" (click)="cerrar.emit()"></div>
    <section #panel class="panel" tabindex="-1" role="dialog" aria-modal="true" [attr.aria-label]="titulo()" [style.max-width.px]="ancho()">
      <header>
        @if (icono()) {
          <span class="icono"><lucide-icon [name]="icono()!" [size]="22" /></span>
        }
        <h2>{{ titulo() }}</h2>
        <button type="button" class="cerrar" (click)="cerrar.emit()" aria-label="Cerrar">
          <lucide-icon name="x" [size]="22" />
        </button>
      </header>
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .fondo {
      position: absolute;
      inset: 0;
      background: rgb(15 23 42 / 45%);
    }
    .panel {
      outline: none;
      position: relative;
      width: 100%;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      padding: 28px;
      border-radius: var(--radio-lg);
      background: var(--blanco);
      box-shadow: var(--sombra-lg);
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    h2 {
      flex: 1;
      font-size: 22px;
      font-weight: 700;
    }
    .icono {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radio);
      background: var(--azul-700);
      color: var(--blanco);
    }
    .cerrar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: var(--radio);
      background: transparent;
      color: var(--gris-500);
      &:hover {
        background: var(--gris-100);
      }
    }
    @media (max-width: 600px) {
      :host {
        align-items: end;
        padding: 0;
      }
      .panel {
        border-radius: var(--radio-lg) var(--radio-lg) 0 0;
        padding: 22px 20px;
      }
    }
  `,
})
export class Modal implements OnDestroy {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly documento = inject(DOCUMENT);
  private readonly origen = this.documento.activeElement as HTMLElement | null;

  readonly titulo = input.required<string>();
  readonly icono = input<string>();
  readonly ancho = input(540);
  readonly cerrar = output<void>();

  constructor() {
    afterNextRender(() => {
      const panel = this.raiz.nativeElement.querySelector<HTMLElement>('.panel');
      (this.enfocables()[0] ?? panel)?.focus();
    });
  }

  ngOnDestroy(): void {
    this.origen?.focus?.();
  }

  protected atrapar(evento: Event): void {
    const lista = this.enfocables();
    if (!lista.length) return;

    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const activo = this.documento.activeElement;
    const atras = (evento as KeyboardEvent).shiftKey;

    if (atras && activo === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!atras && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    return Array.from(
      this.raiz.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }
}
