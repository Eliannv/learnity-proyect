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
    @if (abierto()) {
      <!-- Fondo: un clic fuera cierra el panel; con el teclado se cierra con Escape. -->
      <div class="fondo solo-movil" (click)="cerrar()"></div>
      <nav #panel id="tab-bar-mas" class="panel-mas solo-movil" aria-label="Más secciones">
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
          [attr.aria-expanded]="abierto()" aria-controls="tab-bar-mas" (click)="alternar()">
          <lucide-icon name="layout-grid" [size]="22" aria-hidden="true" />
          <span>Más</span>
        </button>
      }
    </nav>
  `,
  styles: `
    .tab-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      display: flex;
      height: var(--alto-tabbar);
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--blanco);
      border-top: 1px solid var(--gris-200);
    }
    a, .boton-mas {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--gris-500);
      font-size: 12px;
      border-top: 3px solid transparent;
      &.activo {
        color: var(--azul-700);
        font-weight: 600;
        border-top-color: var(--azul-700);
      }
    }
    .boton-mas {
      padding: 0;
      border-left: 0;
      border-right: 0;
      border-bottom: 0;
      background: none;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .fondo {
      position: fixed;
      inset: 0;
      z-index: 38;
      background: rgb(15 23 42 / 35%);
    }
    .panel-mas {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(var(--alto-tabbar) + env(safe-area-inset-bottom));
      z-index: 39;
      max-height: 70dvh;
      overflow-y: auto;
      padding: 12px 16px 16px;
      border-radius: var(--radio-lg) var(--radio-lg) 0 0;
      background: var(--blanco);
      box-shadow: var(--sombra-lg);
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
        padding: 12px;
        border: 1px solid var(--gris-200);
        border-radius: var(--radio);
        color: var(--tinta-700);
        font-size: 14px;
        &.activo { border-color: var(--azul-700); color: var(--azul-700); }
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

  protected readonly abierto = signal(false);
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
    if (this.abierto()) {
      this.cerrar(true);
      return;
    }
    this.abierto.set(true);
    // Lleva el foco a la primera sección para recorrer el panel con el teclado.
    setTimeout(() => this.panel()?.nativeElement.querySelector('a')?.focus());
  }

  protected cerrar(devolverFoco = false): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    if (devolverFoco) this.botonMas()?.nativeElement.focus();
  }
}
