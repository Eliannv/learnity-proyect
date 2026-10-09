import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter, map } from 'rxjs';
import { FooterSitio } from '../shared/layout/footer-sitio';
import { MenuCuenta } from '../shared/layout/menu-cuenta';
import { ItemTab, TabBar } from '../shared/layout/tab-bar';
import { Logo } from '../shared/ui/logo';

interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  exacto?: boolean;
  contador?: string;
  destacado?: boolean; // contador en ámbar (pendientes)
}

const MENU: Record<'DOCENTE' | 'ADMIN', { etiqueta: string; inicio: string; items: ItemMenu[]; tabs: ItemTab[] }> = {
  DOCENTE: {
    etiqueta: 'Docente',
    inicio: '/docente',
    items: [
      { icono: 'user', etiqueta: 'Mi perfil', ruta: '/docente/perfil' },
      { icono: 'layout-grid', etiqueta: 'Panel del docente', ruta: '/docente', exacto: true },
      { icono: 'book-open', etiqueta: 'Mis cursos', ruta: '/docente/cursos', contador: '4' },
      { icono: 'graduation-cap', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes', contador: '128' }
    ],
    tabs: [
      { icono: 'layout-dashboard', etiqueta: 'Panel', ruta: '/docente', exacto: true },
      { icono: 'book-open', etiqueta: 'Mis cursos', ruta: '/docente/cursos' },
      { icono: 'chart-no-axes-column', etiqueta: 'Estudiantes', ruta: '/docente/estudiantes' },
      { icono: 'user', etiqueta: 'Perfil', ruta: '/docente/perfil' }
    ],
  },
  ADMIN: {
    etiqueta: 'Admin',
    inicio: '/admin',
    items: [
      { icono: 'user', etiqueta: 'Mi perfil', ruta: '/admin/perfil' },
      { icono: 'layout-grid', etiqueta: 'Panel general', ruta: '/admin', exacto: true },
      { icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' },
      { icono: 'user-check', etiqueta: 'Solicitudes de docente', ruta: '/admin/solicitudes', contador: '5', destacado: true },
      { icono: 'shield-check', etiqueta: 'Revisión de cursos', ruta: '/admin/revision', contador: '3', destacado: true },
      { icono: 'tags', etiqueta: 'Categorías', ruta: '/admin/categorias' }
    ],
    tabs: [
      { icono: 'layout-dashboard', etiqueta: 'Panel', ruta: '/admin', exacto: true },
      { icono: 'users', etiqueta: 'Usuarios', ruta: '/admin/usuarios' },
      { icono: 'user-check', etiqueta: 'Solicitudes', ruta: '/admin/solicitudes' },
      { icono: 'shield-check', etiqueta: 'Cursos', ruta: '/admin/revision' },
      { icono: 'tags', etiqueta: 'Categorías', ruta: '/admin/categorias' },
      { icono: 'user', etiqueta: 'Perfil', ruta: '/admin/perfil' },
    ],
  },
};

/**
 * Layout de panel para Docente y Administrador (se entra desde el menú de la foto de perfil):
 * riel de íconos que se despliega al pasar el mouse o con el teclado (escritorio),
 * barra superior con la cuenta y barra inferior (teléfono). El rol llega en `data.rol`.
 */
@Component({
  selector: 'app-layout-panel',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, Logo, MenuCuenta, FooterSitio, TabBar],
  templateUrl: './layout-panel.html',
  styleUrl: './layout-panel.scss',
})
export class LayoutPanel {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly rol = toSignal(this.ruta.data.pipe(map((d) => d['rol'] as 'DOCENTE' | 'ADMIN')), {
    initialValue: this.ruta.snapshot.data['rol'] as 'DOCENTE' | 'ADMIN',
  });
  protected readonly config = computed(() => MENU[this.rol()]);
  protected readonly rutaPerfil = computed(() => `${this.config().inicio}/perfil`);

  /** Título de la sección actual (data.seccion de la ruta hija). */
  protected readonly seccion = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.leerSeccion()),
    ),
    { initialValue: this.leerSeccion() },
  );

  private leerSeccion(): string {
    let r = this.ruta.snapshot;
    while (r.firstChild) r = r.firstChild;
    return (r.data['seccion'] as string) ?? '';
  }
}
