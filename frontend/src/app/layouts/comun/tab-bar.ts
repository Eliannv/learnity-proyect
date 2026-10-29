import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

export interface ItemTab {
  icono: string;
  etiqueta: string;
  ruta: string;
  exacto?: boolean;
}

/** Barra de navegación inferior. Solo se muestra en teléfonos. */
@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
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
    a {
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
  `,
})
export class TabBar {
  readonly items = input.required<ItemTab[]>();
}
