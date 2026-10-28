import { Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogoApi, type CursoPublico } from '../../features/catalogo/catalogo.api';
import { PortadaCurso } from '../ui/portada-curso';
import { Logo } from '../ui/logo';
import { MenuCuenta } from './menu-cuenta';
import { VistaPreviaAprendizaje } from './vista-previa-aprendizaje';

/**
 * Header del sitio (HeaderPublic). Cambia según la sesión:
 *  - Visitante: Iniciar sesión + Crear cuenta
 *  - Con sesión: Enseña en Learnity (solo Estudiante), Mi aprendizaje si está habilitado
 *    y la foto de perfil, cuyo menú es el único acceso a los paneles de Docente y Administración.
 */
@Component({
  selector: 'app-header-sitio',
  imports: [RouterLink, LucideAngularModule, Logo, MenuCuenta, VistaPreviaAprendizaje, PortadaCurso],
  host: { '(document:keydown.escape)': 'cerrarMenus()' },
  template: `
    <header>
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

        <form class="buscador oculto-movil" (submit)="buscar($event, termino.value)" role="search"
          (focusout)="alSalirBuscador($event)">
          <lucide-icon name="search" [size]="18" aria-hidden="true" />
          <input #termino type="search" placeholder="Buscar cursos…" aria-label="Buscar cursos" autocomplete="off"
            role="combobox" aria-autocomplete="list" aria-controls="sugerencias-busqueda" [attr.aria-expanded]="panelBusqueda()"
            [attr.aria-activedescendant]="indiceActivo() >= 0 && sugerencias()[indiceActivo()] ? 'sug-curso-' + sugerencias()[indiceActivo()].id : null"
            (input)="escribir(termino.value)" (focus)="escribir(termino.value)" (keydown)="alTeclar($event, termino)" />
          @if (panelBusqueda()) {
            <div class="sugerencias" id="sugerencias-busqueda">
              @if (buscando() && !sugerencias().length) {
                <p class="sugerencias-estado" role="status">Buscando…</p>
              } @else if (sugerencias().length) {
                <ul aria-label="Cursos encontrados" role="listbox" (mouseleave)="indiceActivo.set(-1)">
                  @for (c of sugerencias(); track c.id; let idx = $index) {
                    <li role="option" [id]="'sug-curso-' + c.id" [attr.aria-selected]="indiceActivo() === idx">
                      <a [routerLink]="['/cursos', c.id]"
                        [class.activo]="indiceActivo() === idx"
                        (mouseenter)="indiceActivo.set(idx)"
                        (click)="cerrarBusqueda(termino)">
                        <span class="miniatura"><app-portada-curso [categoria]="c.categoria.nombre" [imagen]="c.portadaUrl" [compacta]="true" /></span>
                        <span class="texto"><strong>{{ c.titulo }}</strong><small>{{ c.docente }} · {{ c.categoria.nombre }}</small></span>
                      </a>
                    </li>
                  }
                </ul>
                <button type="submit" class="ver-todos" [class.activo]="indiceActivo() === sugerencias().length" (mouseenter)="indiceActivo.set(sugerencias().length)">Ver todos los resultados de «{{ consulta() }}»</button>
              } @else {
                <p class="sugerencias-estado" role="status">Ningún curso coincide con «{{ consulta() }}».</p>
              }
            </div>
          }
        </form>

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
          <span class="eyebrow">Categorías</span>
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

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private espera: ReturnType<typeof setTimeout> | undefined;
  private solicitud = 0;
  protected readonly consulta = signal('');
  protected readonly sugerencias = signal<CursoPublico[]>([]);
  protected readonly buscando = signal(false);
  protected readonly indiceActivo = signal<number>(-1);
  protected readonly panelBusqueda = computed(() => this.consulta().length >= 2);

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
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
  }

  /** Vista previa mientras se escribe: espera 250 ms y pide hasta 5 cursos. */
  protected escribir(texto: string): void {
    const termino = texto.trim();
    this.consulta.set(termino);
    this.indiceActivo.set(-1);
    clearTimeout(this.espera);
    if (termino.length < 2) {
      this.sugerencias.set([]);
      return;
    }
    this.buscando.set(true);
    this.espera = setTimeout(() => void this.sugerir(termino), 250);
  }

  private async sugerir(termino: string): Promise<void> {
    const actual = ++this.solicitud;
    try {
      const pagina = await this.catalogoApi.listar({ q: termino, limite: 5 });
      if (actual === this.solicitud) {
        this.sugerencias.set(pagina.items);
        this.indiceActivo.set(-1);
      }
    } catch {
      if (actual === this.solicitud) {
        this.sugerencias.set([]);
        this.indiceActivo.set(-1);
      }
    } finally {
      if (actual === this.solicitud) this.buscando.set(false);
    }
  }

  protected alTeclar(evento: KeyboardEvent, campo: HTMLInputElement): void {
    if (!this.panelBusqueda() || !this.sugerencias().length) return;

    const items = this.sugerencias();
    const totalOpciones = items.length + 1; // cursos + botón "Ver todos"

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      const actual = this.indiceActivo();
      const siguiente = actual < totalOpciones - 1 ? actual + 1 : 0;
      this.indiceActivo.set(siguiente);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      const actual = this.indiceActivo();
      const anterior = actual <= 0 ? totalOpciones - 1 : actual - 1;
      this.indiceActivo.set(anterior);
    } else if (evento.key === 'Enter') {
      const idx = this.indiceActivo();
      if (idx >= 0 && idx < items.length) {
        evento.preventDefault();
        const curso = items[idx]!;
        this.cerrarBusqueda(campo);
        void this.router.navigate(['/cursos', curso.id]);
      } else if (idx === items.length) {
        evento.preventDefault();
        this.buscar(evento, campo.value);
      }
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cerrarBusqueda(campo);
      campo.blur();
    }
  }

  protected alSalirBuscador(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!this.elemento.nativeElement.querySelector('.buscador')?.contains(destino)) {
      this.consulta.set('');
      this.indiceActivo.set(-1);
    }
  }

  protected cerrarBusqueda(campo: HTMLInputElement): void {
    campo.value = '';
    this.consulta.set('');
    this.sugerencias.set([]);
    this.indiceActivo.set(-1);
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
    this.consulta.set('');
    this.indiceActivo.set(-1);
    void this.router.navigate(['/cursos'], { queryParams: termino.trim() ? { q: termino.trim() } : {} });
  }

  protected cerrarMenus() {
    this.menuMovil.set(false);
    this.menuCategorias.set(false);
    this.consulta.set('');
    this.indiceActivo.set(-1);
  }
}
