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

import { MenuCuenta } from '../comun/menu-cuenta';
import { TabBar } from '../comun/tab-bar';
import { Logo } from '../../shared/ui/marca/logo';
import { GRUPO_CUENTA, MENU, type ItemMenu } from './menu-panel';

@Component({
  selector: 'app-layout-panel',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    Logo,
    MenuCuenta,
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

  /** Secciones del menú lateral que no están en la barra inferior: van en su pestaña «Más». */
  protected readonly mas = computed(() => {
    const { items, tabs } = this.config();
    return items.filter((item) => !tabs.some((tab) => tab.ruta === item.ruta));
  });

  /** Grupos del menú lateral en su orden, sin la cuenta (que va al pie). */
  protected readonly grupos = computed(() => {
    const { grupos, items } = this.config();
    return grupos
      .filter((nombre) => nombre !== GRUPO_CUENTA)
      .map((nombre) => ({ nombre, items: items.filter((item) => item.grupo === nombre) }))
      .filter((grupo) => grupo.items.length > 0);
  });

  protected readonly cuenta = computed<ItemMenu[]>(() =>
    this.config().items.filter((item) => item.grupo === GRUPO_CUENTA));

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
    let ruta = this.router.routerState.snapshot.root;
    while (ruta.firstChild) {
      ruta = ruta.firstChild;
    }
    return (ruta.data['seccion'] as string) ?? '';
  }
}
