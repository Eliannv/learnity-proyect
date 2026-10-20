import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogoApi } from '../../features/catalogo/catalogo.api';
import { Logo } from '../ui/logo';
import { MenuCuenta } from './menu-cuenta';
import { VistaPreviaAprendizaje } from './vista-previa-aprendizaje';
import { environment } from '../../../environments/environment';

/**
 * Header del sitio (HeaderPublic). Cambia según la sesión:
 *  - Visitante: Iniciar sesión + Crear cuenta
 *  - Con sesión: Enseña en Learnity (solo Estudiante), Mi aprendizaje si está habilitado
 *    y la foto de perfil, cuyo menú es el único acceso a los paneles de Docente y Administración.
 */
@Component({
  selector: 'app-header-sitio',
  imports: [RouterLink, LucideAngularModule, Logo, MenuCuenta, VistaPreviaAprendizaje],
  host: { '(document:keydown.escape)': 'cerrarMenus()' },
  template: `
    <header>
      <div class="barra">
        <button type="button" class="icono-btn solo-movil" (click)="menuMovil.set(!menuMovil())" [attr.aria-expanded]="menuMovil()" aria-label="Abrir menú">
          <lucide-icon [name]="menuMovil() ? 'x' : 'menu'" [size]="24" />
        </button>

        <a routerLink="/" class="logo-enlace" aria-label="Learnity, inicio"><app-logo [tamano]="24" /></a>

        <div class="categorias oculto-movil">
          <button type="button" class="boton-categorias" (click)="menuCategorias.set(!menuCategorias())" [attr.aria-expanded]="menuCategorias()">
            Explorar <lucide-icon name="chevron-down" [size]="16" />
          </button>
          @if (menuCategorias()) {
            <div class="desplegable">
              @for (c of categorias(); track c) {
                <a routerLink="/cursos" [queryParams]="{ categoria: c }" (click)="cerrarMenus()">{{ c }}</a>
              }
            </div>
          }
        </div>

        <form class="buscador oculto-movil" (submit)="buscar($event, termino.value)" role="search">
          <lucide-icon name="search" [size]="18" />
          <input #termino type="search" placeholder="Buscar cursos…" aria-label="Buscar cursos" />
        </form>

        <div class="acciones">
          @if (auth.autenticado()) {
            @if (!auth.esDocente() && !auth.esAdmin()) {
              <a class="enlace-marca oculto-movil" routerLink="/perfil" [queryParams]="{ solicitud: 1 }">Enseña en Learnity</a>
            }
            @if (sprint34Habilitado) {
              <app-vista-previa-aprendizaje class="oculto-movil" />
            }
            <app-menu-cuenta />
          } @else {
            <a class="enlace-marca oculto-movil" routerLink="/login">Iniciar sesión</a>
            <a class="btn btn-primario btn-sm crear" routerLink="/registro">Crear cuenta</a>
          }
        </div>
      </div>

      @if (menuMovil()) {
        <nav class="menu-movil solo-movil" aria-label="Menú">
          <a routerLink="/" (click)="cerrarMenus()">Inicio</a>
          <a routerLink="/cursos" (click)="cerrarMenus()">Catálogo de cursos</a>
          <span class="eyebrow">Categorías</span>
          @for (c of categorias(); track c) {
            <a class="sub" routerLink="/cursos" [queryParams]="{ categoria: c }" (click)="cerrarMenus()">{{ c }}</a>
          }
          <hr class="separador" />
          @if (auth.autenticado()) {
            @if (sprint34Habilitado) {
              <a routerLink="/mi-aprendizaje" (click)="cerrarMenus()">Mi aprendizaje</a>
            }
            <a [routerLink]="auth.rutaPerfil()" (click)="cerrarMenus()">Mi perfil</a>
            <button type="button" (click)="auth.cerrarSesion()">Cerrar sesión</button>
          } @else {
            <a routerLink="/login" (click)="cerrarMenus()">Iniciar sesión</a>
            <a routerLink="/registro" (click)="cerrarMenus()">Crear cuenta</a>
          }
        </nav>
      }
    </header>
  `,
  styleUrl: './header-sitio.scss',
})
export class HeaderSitio {
  protected readonly auth = inject(AuthService);
  protected readonly sprint34Habilitado = environment.sprint34Habilitado;
  private readonly router = inject(Router);
  private readonly catalogoApi = inject(CatalogoApi);
  protected readonly categorias = signal<string[]>([]);
  protected readonly menuMovil = signal(false);
  protected readonly menuCategorias = signal(false);

  constructor() {
    void this.cargarCategorias();
  }

  private async cargarCategorias(): Promise<void> {
    try {
      const lista = await this.catalogoApi.categorias();
      this.categorias.set(lista.map((c) => c.nombre));
    } catch {
      this.categorias.set([]);
    }
  }

  protected buscar(evento: Event, termino: string) {
    evento.preventDefault();
    void this.router.navigate(['/cursos'], { queryParams: termino.trim() ? { q: termino.trim() } : {} });
  }

  protected cerrarMenus() {
    this.menuMovil.set(false);
    this.menuCategorias.set(false);
  }
}
