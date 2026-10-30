import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogoApi } from '../../features/catalogo/catalogo.api';
import { Logo } from '../../shared/ui/marca/logo';
import { MenuCuenta } from '../comun/menu-cuenta';
import { VistaPreviaAprendizaje } from './vista-previa-aprendizaje';
import { BuscadorCurso, type OpcionCursoBusqueda } from '../../shared/ui/cursos/buscador-curso';

/**
 * Header del sitio (HeaderPublic). Cambia según la sesión:
 *  - Visitante: Iniciar sesión + Crear cuenta
 *  - Con sesión: Enseña en Learnity (solo Estudiante), Mi aprendizaje si está habilitado
 *    y la foto de perfil, cuyo menú es el único acceso a los paneles de Docente y Administración.
 */
@Component({
  selector: 'app-header-sitio',
  imports: [RouterLink, LucideAngularModule, Logo, MenuCuenta, VistaPreviaAprendizaje, BuscadorCurso],
  host: { '(document:keydown.escape)': 'cerrarMenus()', '(window:scroll)': 'alDesplazar()' },
  template: `
    <header [class.desplazado]="desplazado()">
      <div class="barra">

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

        <div class="contenedor-buscador oculto-movil">
          <app-buscador-curso
            variante="header"
            etiqueta="Buscar cursos"
            placeholder="Buscar cursos…"
            [permitirTodos]="false"
            [mostrarBotonVerTodos]="true"
            [buscarRemoto]="buscarCatalogo"
            (cursoSeleccionado)="alElegirCurso($event)"
            (buscarTodos)="alBuscarTodos($event)"
          />
        </div>

        <div class="acciones">
          @if (auth.autenticado()) {
            @if (!auth.esDocente() && !auth.esAdmin()) {
              <a class="enlace-marca oculto-movil" routerLink="/perfil" [queryParams]="{ solicitud: 1 }">Enseña en Learnity</a>
            }
            @if (auth.roles().includes('ESTUDIANTE')) {
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
          <span class="etiqueta-grupo">Categorías</span>
          @for (c of categorias(); track c) {
            <a class="sub" routerLink="/cursos" [queryParams]="{ categoria: c }" (click)="cerrarMenus()">{{ c }}</a>
          }
          <hr class="separador" />
          @if (auth.autenticado()) {
            @if (auth.roles().includes('ESTUDIANTE')) {
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

    <!-- Fila de categorías como en Udemy: fuera del header fijo para no cambiar su altura -->
    @if (mostrarCategorias() && categorias().length) {
      <nav class="barra-categorias oculto-movil" aria-label="Categorías">
        @for (c of categorias(); track c) {
          <a routerLink="/cursos" [queryParams]="{ categoria: c }">{{ c }}</a>
        }
      </nav>
    }
  `,
  styleUrl: './header-sitio.scss',
})
export class HeaderSitio {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly catalogoApi = inject(CatalogoApi);
  protected readonly categorias = signal<string[]>([]);
  protected readonly menuMovil = signal(false);
  protected readonly menuCategorias = signal(false);
  /** La regla inferior de la cabecera solo aparece cuando el contenido pasa por debajo. */
  protected readonly desplazado = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  /** La fila de categorías se ve en la portada y en el catálogo, como en Udemy. */
  protected readonly mostrarCategorias = computed(() => {
    const ruta = this.url().split('?')[0]!;
    return ruta === '/' || ruta === '/cursos';
  });

  constructor() {
    void this.cargarCategorias();
  }

  protected readonly buscarCatalogo = async (termino: string): Promise<OpcionCursoBusqueda[]> => {
    const pagina = await this.catalogoApi.listar({ q: termino, limite: 5 });
    return pagina.items.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      subtitulo: `${c.docente} · ${c.categoria.nombre}`,
      portadaUrl: c.portadaUrl,
      iconoCategoria: c.categoria.icono,
    }));
  };

  protected alElegirCurso(curso: OpcionCursoBusqueda | null): void {
    if (curso) {
      void this.router.navigate(['/cursos', curso.id]);
    }
  }

  protected alBuscarTodos(termino: string): void {
    void this.router.navigate(['/cursos'], { queryParams: termino.trim() ? { q: termino.trim() } : {} });
  }

  private async cargarCategorias(): Promise<void> {
    try {
      const lista = await this.catalogoApi.categorias();
      this.categorias.set(lista.map((c) => c.nombre));
    } catch {
      this.categorias.set([]);
    }
  }

  protected alDesplazar(): void {
    const desplazado = window.scrollY > 4;
    if (desplazado !== this.desplazado()) this.desplazado.set(desplazado);
  }

  protected cerrarMenus() {
    this.menuMovil.set(false);
    this.menuCategorias.set(false);
  }
}
