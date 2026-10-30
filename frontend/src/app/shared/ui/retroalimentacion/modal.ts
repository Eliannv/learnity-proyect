import {
  type AnimationCallbackEvent,
  Component,
  DOCUMENT,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** Duración de la salida más larga (la hoja del móvil, --t-hoja), con margen por si no llega `animationend`. */
const SALIDA_MS = 380;

/**
 * Ventana modal con fondo oscuro. Se cierra con la X, con Escape o al hacer clic fuera.
 * Al abrirse lleva el foco al diálogo, lo mantiene dentro con Tab y lo devuelve al elemento que la abrió.
 * Movimiento (apple-design): en escritorio crece de 0,96 a 1 y vuelve por el mismo camino; en el móvil es una hoja
 * que sube y baja. El panel nunca se funde al entrar (axe mide su contraste en cuanto se abre); al salir sí, porque
 * mientras sale es `inert` y axe lo omite.
 */
@Component({
  selector: 'app-modal',
  imports: [LucideAngularModule],
  host: {
    '(document:keydown.escape)': 'cerrar.emit()',
    '(keydown.tab)': 'atrapar($event)',
    '(keydown.shift.tab)': 'atrapar($event)',
    '(animate.leave)': 'alSalir($event)',
  },
  template: `
    <div class="fondo" (click)="cerrar.emit()"></div>
    <section #panel class="panel" tabindex="-1" role="dialog" aria-modal="true" [attr.aria-label]="titulo()" [style.max-width.px]="ancho()">
      <header>
        @if (icono()) {
          <lucide-icon class="icono" [name]="icono()!" [size]="22" aria-hidden="true" />
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
      background: rgb(17 24 39 / 45%);
      animation: fondo-entrar var(--t-panel) var(--curva-salida);
    }
    .panel {
      outline: none;
      position: relative;
      width: 100%;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 28px;
      border-radius: var(--radio-lg);
      background: var(--superficie);
      box-shadow: var(--sombra-flotante);
      animation: panel-entrar var(--t-panel) var(--curva-salida);
    }
    /* Saliendo: no recibe clics (el fondo deja pasar al de debajo) y recorre el camino de entrada al revés. */
    :host(.saliendo) {
      pointer-events: none;
      .fondo {
        animation: fondo-salir var(--t-micro) var(--curva-salida) forwards;
      }
      .panel {
        animation: panel-salir var(--t-micro) var(--curva-salida) forwards;
      }
    }
    @keyframes fondo-entrar { from { opacity: 0; } }
    @keyframes fondo-salir { to { opacity: 0; } }
    @keyframes panel-entrar { from { transform: scale(0.96); } }
    @keyframes panel-salir { to { transform: scale(0.96); opacity: 0; } }
    @keyframes hoja-subir { from { transform: translateY(100%); } }
    @keyframes hoja-bajar { to { transform: translateY(100%); } }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    h2 {
      flex: 1;
      font-size: 20px;
      font-weight: 600;
    }
    .icono {
      flex: none;
      color: var(--tinta-2);
    }
    .cerrar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: var(--radio-sm);
      background: transparent;
      color: var(--tinta-3);
      transition: background-color var(--t-micro) var(--curva-salida), transform var(--t-pulsar) var(--curva-salida);
      &:hover {
        background: var(--activo);
        color: var(--tinta);
      }
      &:active {
        transform: scale(0.94);
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
        animation: hoja-subir var(--t-hoja) var(--curva-hoja);
      }
      :host(.saliendo) .panel {
        animation: hoja-bajar var(--t-hoja) var(--curva-hoja) forwards;
      }
      :host(.saliendo) .fondo {
        animation-duration: var(--t-hoja);
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

  /**
   * Angular retiene el nodo hasta llamar a `animationComplete`. Mientras sale es inerte: no atrapa el foco ni los
   * clics y axe no lo mide. Termina con la animación del panel o, si no la hay (movimiento reducido), con el tope.
   */
  protected alSalir(evento: AnimationCallbackEvent): void {
    const host = evento.target as HTMLElement;
    host.inert = true;
    host.classList.add('saliendo');
    let hecho = false;
    const terminar = () => {
      if (hecho) return;
      hecho = true;
      evento.animationComplete();
    };
    host.querySelector('.panel')?.addEventListener('animationend', terminar, { once: true });
    setTimeout(terminar, SALIDA_MS);
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
