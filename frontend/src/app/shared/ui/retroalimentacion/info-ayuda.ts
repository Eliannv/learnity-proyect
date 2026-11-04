import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

let siguienteId = 0;

/** Ancho máximo del panel y margen con el borde de la pantalla (px). */
const ANCHO = 340;
const MARGEN = 16;
/** Reserva inferior: la barra de pestañas del móvil (64 px) y un respiro. */
const RESERVA_INFERIOR = 80;

/**
 * Ícono (i) que despliega ayuda contextual: la información que ocuparía espacio en la interfaz
 * queda resumida aquí y solo aparece cuando el usuario la pide. El contenido se proyecta,
 * normalmente como `<li>` (admite `<strong>`):
 *
 *   <app-info-ayuda etiqueta="Ayuda sobre la portada">
 *     <li>JPG, PNG o WebP en proporción <strong>16:9</strong>.</li>
 *   </app-info-ayuda>
 *
 * Se abre y cierra con clic, Enter o Espacio; Escape o un clic fuera lo cierran y el foco vuelve al botón.
 * El panel es `position: fixed`, así que ninguna tarjeta con `overflow` lo recorta y en el móvil no se sale.
 */
@Component({
  selector: 'app-info-ayuda',
  imports: [LucideAngularModule],
  host: {
    class: 'info-ayuda',
    '(document:keydown.escape)': 'cerrar(true)',
    '(document:pointerdown)': 'alPulsarFuera($event)',
    '(window:resize)': 'cerrar()',
    '(window:scroll)': 'cerrar()',
  },
  template: `
    <button
      #boton
      type="button"
      class="boton-info"
      [attr.aria-label]="etiqueta()"
      [attr.aria-expanded]="abierto()"
      [attr.aria-controls]="id"
      (click)="alternar()"
    >
      <lucide-icon name="info" [size]="tamano()" aria-hidden="true" />
    </button>
    <div
      class="panel-info"
      role="region"
      [id]="id"
      [attr.aria-label]="titulo()"
      [hidden]="!abierto()"
      [style.top.px]="posicion().top"
      [style.left.px]="posicion().left"
      [style.max-height.px]="posicion().alto"
    >
      <p class="titulo-info">{{ titulo() }}</p>
      <ul>
        <ng-content />
      </ul>
    </div>
  `,
  styles: `
    :host { position: relative; display: inline-flex; vertical-align: middle; }
    .boton-info {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--acento);
      cursor: pointer;
      transition: background-color var(--t-micro) var(--curva-salida);
    }
    .boton-info:hover, .boton-info[aria-expanded='true'] { background: var(--acento-suave); }
    .boton-info:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }
    .panel-info {
      position: fixed;
      z-index: var(--z-modal);
      width: min(${ANCHO}px, calc(100vw - ${MARGEN * 2}px));
      overflow-y: auto;
      padding: 16px 18px;
      border: 1px solid var(--borde);
      border-radius: var(--radio-lg);
      background: var(--superficie);
      box-shadow: var(--sombra-flotante);
      color: var(--tinta-2);
      font-size: 14px;
      font-weight: 400;
      line-height: 1.5;
      text-align: left;
      white-space: normal;
      animation: aparecer var(--t-micro) var(--curva-salida);
    }
    .panel-info[hidden] { display: none; }
    .titulo-info { margin: 0 0 8px; color: var(--acento); font-size: 15px; font-weight: 600; }
    ul { display: grid; gap: 8px; margin: 0; padding-left: 18px; }
    ::ng-deep .panel-info li strong { color: var(--tinta); font-weight: 600; }
    @keyframes aparecer { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .panel-info { animation: none; } }
  `,
})
export class InfoAyuda {
  /** Nombre accesible del botón, p. ej. «Ayuda sobre la portada». */
  readonly etiqueta = input('Más información');
  readonly titulo = input('Información importante');
  readonly tamano = input(18);

  protected readonly id = `info-ayuda-${++siguienteId}`;
  protected readonly abierto = signal(false);
  protected readonly posicion = signal({ top: 0, left: 0, alto: 420 });
  private readonly boton = viewChild.required<ElementRef<HTMLButtonElement>>('boton');
  private readonly elemento = inject(ElementRef<HTMLElement>);

  protected alternar(): void {
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    const r = this.boton().nativeElement.getBoundingClientRect();
    const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2);
    const left = Math.min(Math.max(MARGEN, r.left - 12), window.innerWidth - ancho - MARGEN);
    const top = r.bottom + 8;
    // Siempre cabe en la pantalla: si el contenido es más largo, el panel se desplaza por dentro.
    const alto = Math.max(160, Math.min(420, window.innerHeight - top - RESERVA_INFERIOR));
    this.posicion.set({ top, left, alto });
    this.abierto.set(true);
  }

  protected cerrar(devolverFoco = false): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    if (devolverFoco) this.boton().nativeElement.focus();
  }

  protected alPulsarFuera(evento: PointerEvent): void {
    if (this.abierto() && !this.elemento.nativeElement.contains(evento.target as Node)) this.cerrar();
  }
}
