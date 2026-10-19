import {
  Component,
  computed,
  inject,
} from '@angular/core';

import { toSignal } from '@angular/core/rxjs-interop';

import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import { LucideAngularModule } from 'lucide-angular';
import { filter, map } from 'rxjs';

import { FooterSitio } from '../shared/layout/footer-sitio';
import { MenuCuenta } from '../shared/layout/menu-cuenta';
import { TabBar } from '../shared/layout/tab-bar';
import { Logo } from '../shared/ui/logo';
import { MENU } from './menu-panel';

@Component({
  selector: 'app-layout-panel',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    Logo,
    MenuCuenta,
    FooterSitio,
    TabBar,
  ],
  templateUrl: './layout-panel.html',
  styleUrl: './layout-panel.scss',
})
export class LayoutPanel {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly rol = toSignal(
    this.ruta.data.pipe(
      map(
        (datos) =>
          datos['rol'] as 'DOCENTE' | 'ADMIN',
      ),
    ),
    {
      initialValue: this.ruta.snapshot.data['rol'] as
        | 'DOCENTE'
        | 'ADMIN',
    },
  );

  protected readonly config = computed(
    () => MENU[this.rol()],
  );

  protected readonly rutaPerfil = computed(
    () => `${this.config().inicio}/perfil`,
  );

  protected readonly seccion = toSignal(
    this.router.events.pipe(
      filter(
        (evento) => evento instanceof NavigationEnd,
      ),
      map(() => this.leerSeccion()),
    ),
    {
      initialValue: this.leerSeccion(),
    },
  );

  private leerSeccion(): string {
    let rutaActual = this.ruta.snapshot;

    while (rutaActual.firstChild) {
      rutaActual = rutaActual.firstChild;
    }

    return (
      (rutaActual.data['seccion'] as string) ?? ''
    );
  }
}
