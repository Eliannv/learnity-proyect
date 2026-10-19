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
import {
  ItemTab,
  TabBar,
} from '../shared/layout/tab-bar';
import { Logo } from '../shared/ui/logo';
import { environment } from '../../environments/environment';

interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  exacto?: boolean;
  contador?: string;
  destacado?: boolean;
}

const MENU: Record<
  'DOCENTE' | 'ADMIN',
  {
    etiqueta: string;
    inicio: string;
    items: ItemMenu[];
    tabs: ItemTab[];
  }
> = {
  DOCENTE: {
    etiqueta: 'Docente',
    inicio: '/docente',

    items: [
      {
        icono: 'user',
        etiqueta: 'Mi perfil',
        ruta: '/docente/perfil',
      },
      {
        icono: 'book-open',
        etiqueta: 'Mis cursos',
        ruta: '/docente/cursos',
      },
      ...(environment.sprint34Habilitado
        ? [{ icono: 'graduation-cap', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes' }]
        : []),
    ],

    tabs: [
      {
        icono: 'book-open',
        etiqueta: 'Mis cursos',
        ruta: '/docente/cursos',
      },
      ...(environment.sprint34Habilitado
        ? [{ icono: 'chart-no-axes-column', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes' }]
        : []),
      {
        icono: 'user',
        etiqueta: 'Perfil',
        ruta: '/docente/perfil',
      },
    ],
  },

  ADMIN: {
    etiqueta: 'Admin',
    inicio: '/admin',

    items: [
      {
        icono: 'user',
        etiqueta: 'Mi perfil',
        ruta: '/admin/perfil',
      },
      ...(environment.sprint34Habilitado
        ? [{ icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' }]
        : []),
      {
        icono: 'user-check',
        etiqueta: 'Solicitudes de docente',
        ruta: '/admin/solicitudes',
      },
      {
        icono: 'shield-check',
        etiqueta: 'Revisión de cursos',
        ruta: '/admin/revision',
      },
      {
        icono: 'tags',
        etiqueta: 'Categorías',
        ruta: '/admin/categorias',
      },
    ],

    tabs: [
      ...(environment.sprint34Habilitado
        ? [{ icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' }]
        : []),
      {
        icono: 'user-check',
        etiqueta: 'Solicitudes',
        ruta: '/admin/solicitudes',
      },
      {
        icono: 'shield-check',
        etiqueta: 'Cursos',
        ruta: '/admin/revision',
      },
      {
        icono: 'tags',
        etiqueta: 'Categorías',
        ruta: '/admin/categorias',
      },
      {
        icono: 'user',
        etiqueta: 'Perfil',
        ruta: '/admin/perfil',
      },
    ],
  },
};

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
