import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter, map } from 'rxjs';

export interface ItemTab {
  icono: string;
  etiqueta: string;
  ruta: string;
  exacto?: boolean;
}

/** Duración de la salida del panel «Más»: la de --t-hoja. */
const SALIDA_MS = 320;

/**
 * Barra de navegación inferior. Solo se muestra en teléfonos.
 * Con `mas`, la última pestaña es «Más»: abre un panel con las secciones que no caben en la barra
 * (se cierra con Escape, al pulsar fuera o al elegir una sección).
 */
@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  host: { '(document:keydown.escape)': 'cerrar(true)' },
  template: `
    @if (estado() !== 'cerrado') {
      <!-- Fondo: un clic fuera cierra el panel; con el teclado se cierra con Escape. -->
      <div class="fondo solo-movil" [class.saliendo]="estado() === 'cerrando'" (click)="cerrar()"></div>
      <nav #panel id="tab-bar-mas" class="panel-mas solo-movil" [class.saliendo]="estado() === 'cerrando'"
        [attr.inert]="estado() === 'cerrando' ? '' : null" aria-label="Más secciones">
        <ul>
          @for (item of mas(); track item.ruta) {
            <li>
              <a [routerLink]="item.ruta" routerLinkActive="activo" ariaCurrentWhenActive="page" (click)="cerrar()">
                <lucide-icon [name]="item.icono" [size]="20" aria-hidden="true" />
                <span>{{ item.etiqueta }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    }
    <nav class="tab-bar solo-movil" aria-label="Navegación principal">
      @for (item of items(); track item.etiqueta) {
        <a
          [routerLink]="item.ruta"
          routerLinkActive="activo"
          [routerLinkActiveOptions]="{ exact: item.exacto ?? false }"
        >
          <lucide-icon [name]="item.icono" [size]="22" />
          <span>{{ item.etiqueta }}</span>
        </a>
      }
      @if (mas().length) {
        <button #botonMas type="button" class="boton-mas" [class.activo]="masActivo()"
          [attr.aria-expanded]="estado() === 'abierto'" aria-controls="tab-bar-mas" (click)="alternar()">
          <lucide-icon name="layout-grid" [size]="22" aria-hidden="true" />
          <span>Más</span>
        </button>
      }
    </nav>
  `,
  styles: `
    /* Pestaña activa: el ícono en el acento con una marca superior de 2px; la etiqueta en tinta. */
    .tab-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      display: flex;
      height: var(--alto-tabbar);
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--superficie);
      border-top: 1px solid var(--borde);
    }
    a, .boton-mas {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--tinta-3);
      font-size: 12px;
      transition:
        color var(--t-micro) var(--curva-salida),
        transform var(--t-pulsar) var(--curva-salida);
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        width: 32px;
        height: 2px;
        border-radius: 0 0 2px 2px;
        background: var(--acento);
        transform: translateX(-50%) scaleX(0);
        transition: transform var(--t-panel) var(--curva-salida);
      }
      &:active {
        transform: scale(0.94);
      }
      &.activo {
        color: var(--tinta);
        font-weight: 600;
        lucide-icon { color: var(--acento); }
        &::before { transform: translateX(-50%) scaleX(1); }
      }
    }
    .boton-mas {
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    /* Panel «Más»: hoja que sube desde la barra y baja por el mismo camino (apple-design §7). */
    .fondo {
      position: fixed;
      inset: 0;
      z-index: 38;
      background: rgb(17 24 39 / 35%);
      transition: opacity var(--t-hoja) var(--curva-hoja);
      @starting-style { opacity: 0; }
      &.saliendo { opacity: 0; }
    }
    .panel-mas {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(var(--alto-tabbar) + env(safe-area-inset-bottom));
      z-index: 39;
      max-height: 70dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 12px 16px 16px;
      border-radius: var(--radio-lg) var(--radio-lg) 0 0;
      background: var(--superficie);
      box-shadow: var(--sombra-flotante);
      transition:
        transform var(--t-hoja) var(--curva-hoja),
        opacity var(--t-hoja) var(--curva-hoja);
      @starting-style { transform: translateY(100%); }
      &.saliendo { transform: translateY(100%); }
      ul {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      a {
        flex-direction: row;
        justify-content: flex-start;
        gap: 10px;
        min-height: 48px;
        padding: 0 12px;
        border-radius: var(--radio);
        background: var(--elevado);
        color: var(--tinta-2);
        font-size: 14px;
        &::before { display: none; }
        &:active { transform: scale(0.97); }
        &.activo { background: var(--acento-suave); color: var(--acento-tinta); }
      }
    }
    /* Movimiento reducido: un fundido, sin recorrido. */
    @media (prefers-reduced-motion: reduce) {
      .panel-mas {
        @starting-style { transform: none; opacity: 0; }
        &.saliendo { transform: none; opacity: 0; }
      }
    }
  `,
})
export class TabBar {
  private readonly router = inject(Router);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly botonMas = viewChild<ElementRef<HTMLButtonElement>>('botonMas');

  readonly items = input.required<ItemTab[]>();
  /** Secciones que no caben en la barra; si hay alguna, aparece la pestaña «Más». */
  readonly mas = input<ItemTab[]>([]);

  /** «cerrando» mantiene el panel montado mientras baja; volver a abrirlo lo recupera desde donde va. */
  protected readonly estado = signal<'cerrado' | 'abierto' | 'cerrando'>('cerrado');
  private salida: ReturnType<typeof setTimeout> | undefined;
  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  /** La página actual es una de las secciones de «Más». */
  protected readonly masActivo = computed(() => {
    const url = this.url().split(/[?#]/)[0]!;
    return this.mas().some((item) => url === item.ruta || url.startsWith(item.ruta + '/'));
  });

  protected alternar(): void {
    if (this.estado() === 'abierto') {
      this.cerrar(true);
      return;
    }
    clearTimeout(this.salida);
    this.estado.set('abierto');
    // Lleva el foco a la primera sección para recorrer el panel con el teclado.
    // Si se cierra antes (Escape inmediato), el foco ya volvió al botón y no debe entrar en el panel que sale.
    setTimeout(() => {
      if (this.estado() === 'abierto') this.panel()?.nativeElement.querySelector('a')?.focus();
    });
  }

  protected cerrar(devolverFoco = false): void {
    if (this.estado() !== 'abierto') return;
    this.estado.set('cerrando');
    if (devolverFoco) this.botonMas()?.nativeElement.focus();
    // Se desmonta al terminar de bajar (el mismo tiempo que --t-hoja).
    this.salida = setTimeout(() => this.estado.set('cerrado'), SALIDA_MS);
  }
}
