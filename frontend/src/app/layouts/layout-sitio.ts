import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { FooterSitio } from '../shared/layout/footer-sitio';
import { HeaderSitio } from '../shared/layout/header-sitio';
import { ItemTab, TabBar } from '../shared/layout/tab-bar';

/** Layout del sitio público y de la vista Estudiante: header, contenido, footer y barra inferior móvil. */
@Component({
  selector: 'app-layout-sitio',
  imports: [RouterOutlet, HeaderSitio, FooterSitio, TabBar],
  template: `
    <app-header-sitio />
    <main>
      <router-outlet />
    </main>
    <app-footer-sitio [autenticado]="auth.autenticado()" [rutaPerfil]="auth.rutaPerfil()" />
    <app-tab-bar [items]="tabs()" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    main {
      flex: 1;
    }
    @media (max-width: 900px) {
      :host {
        padding-bottom: var(--alto-tabbar);
      }
    }
  `,
})
export class LayoutSitio {
  protected readonly auth = inject(AuthService);

  protected readonly tabs = computed<ItemTab[]>(() => {
    // Sin sesión, "Mi aprendizaje" y "Perfil" llevan al login (los protege el guard).
    return [
      { icono: 'house', etiqueta: 'Inicio', ruta: '/', exacto: true },
      { icono: 'layout-grid', etiqueta: 'Catálogo', ruta: '/cursos' },
      { icono: 'graduation-cap', etiqueta: 'Mi aprendizaje', ruta: '/mi-aprendizaje' },
      { icono: 'user', etiqueta: 'Perfil', ruta: '/perfil' },
    ];
  });
}
