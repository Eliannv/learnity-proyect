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
import { AuthService } from '../../core/auth/auth.service';
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
  private readonly auth = inject(AuthService);

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

  /** Quien es Admin y Docente cambia de panel en un clic; cada panel conserva sus propias páginas. */
  protected readonly ambitos = computed(() =>
    this.auth.esAdmin() && this.auth.esDocente()
      ? [
          { rol: 'ADMIN' as const, etiqueta: 'Admin', ruta: '/admin', activo: this.rol() === 'ADMIN' },
          { rol: 'DOCENTE' as const, etiqueta: 'Docente', ruta: '/docente', activo: this.rol() === 'DOCENTE' },
        ]
      : [],
  );
  protected readonly otroAmbito = computed(() => this.ambitos().find((a) => !a.activo) ?? null);

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

  private readonly url = toSignal(
    this.router.events.pipe(filter((evento) => evento instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  /** Una sección unida (p. ej. Categorías dentro de «Cursos y categorías») marca su entrada del menú. */
  protected activaPorAlias(item: ItemMenu): boolean {
    const ruta = this.url().split(/[?#]/)[0]!;
    return (item.tambien ?? []).some((alias) => ruta === alias || ruta.startsWith(alias + '/'));
  }

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
