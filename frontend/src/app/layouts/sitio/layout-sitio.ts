import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FooterSitio } from '../comun/footer-sitio';
import { HeaderSitio } from './header-sitio';
import { ItemTab, TabBar } from '../comun/tab-bar';

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
    // Sin sesión, "Perfil" lleva al login (lo protege el guard).
    return [
      { icono: 'house', etiqueta: 'Inicio', ruta: '/', exacto: true },
      { icono: 'layout-grid', etiqueta: 'Catálogo', ruta: '/cursos' },
      ...(this.auth.roles().includes('ESTUDIANTE')
        ? [{ icono: 'graduation-cap', etiqueta: 'Mi aprendizaje', ruta: '/mi-aprendizaje' }]
        : []),
      { icono: 'user', etiqueta: 'Perfil', ruta: '/perfil' },
    ];
  });
}
