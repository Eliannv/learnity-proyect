import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LUCIDE_ICONS, LucideAngularModule, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../marca/iconos';
import { PortadaCurso } from './portada-curso';

export interface OpcionCursoBusqueda {
  id: number;
  titulo: string;
  subtitulo?: string | null;
  portadaUrl?: string | null;
  iconoCategoria?: string | null;
  estado?: string | null;
}

const ESTADOS: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  RECHAZADO: 'Rechazado',
  PUBLICADO: 'Publicado',
  SUSPENDIDO: 'Suspendido',
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Buscador y selector accesible de cursos con autocompletado y previsualización.
 * No despliega lista previa al enfocar: solo muestra cursos al escribir una búsqueda.
 * El estado por defecto (sin búsqueda activa) es "Todos los cursos".
 */
@Component({
  selector: 'app-buscador-curso',
  imports: [LucideAngularModule, PortadaCurso],
  providers: [
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
  ],
  host: {
    '(document:click)': 'alHacerClickFuera($event)',
    '(document:keydown.escape)': 'alPulsarEscape()',
  },
  template: `
    <div class="buscador-curso" [class.variante-header]="variante() === 'header'" [class.abierto]="desplegado()">
      @if (etiqueta() && mostrarEtiqueta()) {
        <label [for]="idCampo()" class="etiqueta">{{ etiqueta() }}</label>
      }

      <div class="campo-contenedor">
        <lucide-icon name="search" [size]="18" class="icono-buscar" aria-hidden="true" />

        <input
          #campo
          [id]="idCampo()"
          type="search"
          [placeholder]="placeholderActual()"
          [attr.aria-label]="etiqueta()"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-expanded]="desplegado()"
          [attr.aria-controls]="idLista()"
          [attr.aria-activedescendant]="idOpcionActiva()"
          [value]="textoVisible()"
          (focus)="alEnfocar(campo)"
          (input)="alEscribir(campo.value)"
          (keydown)="alTeclar($event, campo)"
          (focusout)="alSalir($event)"
        />

        @if (cursoId() !== null || consulta()) {
          <button
            type="button"
            class="btn-limpiar"
            aria-label="Limpiar búsqueda o selección"
            title="Limpiar"
            (mousedown)="limpiar(campo, $event)"
          >
            <lucide-icon name="x" [size]="14" aria-hidden="true" />
          </button>
        }
      </div>

      @if (desplegado()) {
        <div class="desplegable-sugerencias" [id]="idLista()" role="listbox" (mouseleave)="indiceActivo.set(-1)">
          @if (cargando()) {
            <p class="estado-sugerencias" role="status">Buscando cursos…</p>
          } @else if (opcionesVisibles().length === 0) {
            <p class="estado-sugerencias" role="status">
              Ningún curso coincide con «{{ consulta() }}».
            </p>
          } @else {
            <ul class="lista-opciones">
              @for (opcion of opcionesVisibles(); track opcion.id; let idx = $index) {
                <li
                  role="option"
                  [id]="idOpcion(opcion.id)"
                  [attr.aria-selected]="indiceActivo() === idx"
                  [class.activo]="indiceActivo() === idx"
                  [class.seleccionado]="estaSeleccionado(opcion)"
                  (mouseenter)="indiceActivo.set(idx)"
                  (mousedown)="seleccionar(opcion, $event)"
                >
                  <div class="miniatura" aria-hidden="true">
                    @if (opcion.portadaUrl && !portadasFallidas()[opcion.id]) {
                      <img [src]="opcion.portadaUrl" alt="" width="48" height="32" loading="lazy" (error)="marcarPortadaFallida(opcion.id)" />
                    } @else if (opcion.iconoCategoria) {
                      <app-portada-curso [iconoCategoria]="opcion.iconoCategoria" [compacta]="true" />
                    } @else {
                      <span class="portada-inicial">{{ inicial(opcion.titulo) }}</span>
                    }
                  </div>

                  <div class="info">
                    <strong class="titulo">{{ opcion.titulo }}</strong>
                    @if (opcion.subtitulo) {
                      <small class="subtitulo">{{ opcion.subtitulo }}</small>
                    } @else if (opcion.estado) {
                      <small class="subtitulo">{{ formatearEstado(opcion.estado) }}</small>
                    }
                  </div>

                  @if (estaSeleccionado(opcion)) {
                    <lucide-icon name="check" [size]="16" class="icono-check" aria-hidden="true" />
                  }
                </li>
              }
            </ul>

            @if (mostrarBotonVerTodos() && consulta()) {
              <button
                type="button"
                class="ver-todos"
                [class.activo]="indiceActivo() === opcionesVisibles().length"
                (mouseenter)="indiceActivo.set(opcionesVisibles().length)"
                (mousedown)="alClickVerTodos($event)"
              >
                Ver todos los resultados de «{{ consulta() }}»
              </button>
            }
          }
        </div>
      }
    </div>
  `,
  styleUrl: './buscador-curso.scss',
})
export class BuscadorCurso {
  readonly idCampo = input<string>('buscador-curso-' + Math.random().toString(36).substring(2, 7));
  readonly variante = input<'campo' | 'header'>('campo');
  readonly placeholder = input<string>('Buscar curso…');
  readonly etiqueta = input<string>('Filtrar por curso');
  readonly mostrarEtiqueta = input<boolean>(false);
  readonly cursos = input<OpcionCursoBusqueda[]>([]);
  readonly cursoId = input<number | null>(null);
  readonly permitirTodos = input<boolean>(true);
  readonly textoTodos = input<string>('Todos los cursos');
  readonly mostrarBotonVerTodos = input<boolean>(false);
  readonly buscarRemoto = input<((termino: string) => Promise<OpcionCursoBusqueda[]>) | null>(null);

  readonly seleccion = output<number | null>();
  readonly cursoSeleccionado = output<OpcionCursoBusqueda | null>();
  readonly buscarTodos = output<string>();
  readonly terminoCambio = output<string>();

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private espera: ReturnType<typeof setTimeout> | undefined;

  protected readonly consulta = signal('');
  protected readonly escribiendo = signal(false);
  protected readonly enfocado = signal(false);
  protected readonly cerradoManual = signal(false);
  protected readonly cargando = signal(false);
  protected readonly indiceActivo = signal(-1);
  protected readonly resultadosRemotos = signal<OpcionCursoBusqueda[]>([]);

  protected readonly idLista = computed(() => `${this.idCampo()}-lista`);

  /** Solo se despliega cuando hay texto de búsqueda activo (como el navbar de la página principal). */
  protected readonly desplegado = computed(() => {
    if (this.cerradoManual()) return false;
    if (!this.enfocado()) return false;
    const q = this.consulta().trim();
    const minLongitud = this.buscarRemoto() ? 2 : 1;
    return q.length >= minLongitud;
  });

  protected readonly cursoActual = computed(() => {
    const id = this.cursoId();
    if (id === null || id === undefined) return null;
    return this.cursos().find((c) => c.id === id) ?? null;
  });

  protected readonly textoVisible = computed(() => {
    if (this.escribiendo()) return this.consulta();
    const actual = this.cursoActual();
    if (actual) return actual.titulo;
    return '';
  });

  /** Por defecto (sin búsqueda ni selección) muestra la opción predeterminada "Todos los cursos". */
  protected readonly placeholderActual = computed(() => {
    const actual = this.cursoActual();
    if (actual) return actual.titulo;
    if (this.cursoId() === null && this.permitirTodos() && this.textoTodos()) {
      return this.textoTodos();
    }
    return this.placeholder();
  });

  /** Solo devuelve cursos reales coincidentes. No incluye la opción sintética de "Todos los cursos". */
  protected readonly opcionesVisibles = computed<OpcionCursoBusqueda[]>(() => {
    const q = normalizar(this.consulta().trim());
    if (!q) {
      return [];
    }

    if (this.buscarRemoto()) {
      return this.resultadosRemotos();
    }

    const todos = this.cursos();
    return todos.filter((c) => normalizar(c.titulo).includes(q));
  });

  protected readonly idOpcionActiva = computed(() => {
    const idx = this.indiceActivo();
    const opciones = this.opcionesVisibles();
    if (idx >= 0 && idx < opciones.length) {
      return this.idOpcion(opciones[idx]!.id);
    }
    return null;
  });

  protected idOpcion(id: number): string {
    return `${this.idCampo()}-opt-${id}`;
  }

  protected inicial(titulo: string): string {
    return titulo.trim().charAt(0).toUpperCase() || 'C';
  }

  protected formatearEstado(estado: string): string {
    return ESTADOS[estado] ?? estado;
  }

  protected readonly portadasFallidas = signal<Record<number, boolean>>({});

  protected marcarPortadaFallida(id: number): void {
    this.portadasFallidas.update((mapa) => ({ ...mapa, [id]: true }));
  }

  protected estaSeleccionado(opcion: OpcionCursoBusqueda): boolean {
    return this.cursoId() === opcion.id;
  }

  protected alEnfocar(campo?: HTMLInputElement): void {
    this.enfocado.set(true);
    this.cerradoManual.set(false);
    this.indiceActivo.set(-1);
    if (this.cursoActual()) {
      campo?.select();
    }
  }

  protected alEscribir(valor: string): void {
    this.escribiendo.set(true);
    this.cerradoManual.set(false);
    this.consulta.set(valor);
    this.indiceActivo.set(-1);
    this.terminoCambio.emit(valor);

    if (!valor.trim() && this.cursoId() !== null) {
      this.seleccion.emit(null);
      this.cursoSeleccionado.emit(null);
    }

    const buscarFn = this.buscarRemoto();
    if (buscarFn) {
      clearTimeout(this.espera);
      const termino = valor.trim();
      if (termino.length < 2) {
        this.resultadosRemotos.set([]);
        this.cargando.set(false);
        return;
      }
      this.cargando.set(true);
      this.espera = setTimeout(async () => {
        try {
          const res = await buscarFn(termino);
          this.resultadosRemotos.set(res);
        } catch {
          this.resultadosRemotos.set([]);
        } finally {
          this.cargando.set(false);
        }
      }, 250);
    }
  }

  protected alTeclar(evento: KeyboardEvent, campo: HTMLInputElement): void {
    if (!this.desplegado()) {
      return;
    }

    const opciones = this.opcionesVisibles();
    const total = opciones.length + (this.mostrarBotonVerTodos() && this.consulta() ? 1 : 0);
    if (total === 0) {
      if (evento.key === 'Escape') {
        this.alPulsarEscape();
        campo.blur();
      }
      return;
    }

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      const actual = this.indiceActivo();
      const siguiente = actual < total - 1 ? actual + 1 : 0;
      this.indiceActivo.set(siguiente);
      this.desplazarAOpcion(siguiente);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      const actual = this.indiceActivo();
      const anterior = actual <= 0 ? total - 1 : actual - 1;
      this.indiceActivo.set(anterior);
      this.desplazarAOpcion(anterior);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const idx = this.indiceActivo();
      if (idx >= 0 && idx < opciones.length) {
        this.seleccionar(opciones[idx]!);
      } else if (idx === opciones.length && this.mostrarBotonVerTodos()) {
        this.ejecutarBuscarTodos();
      } else if (opciones.length === 1) {
        this.seleccionar(opciones[0]!);
      } else if (this.mostrarBotonVerTodos()) {
        this.ejecutarBuscarTodos();
      }
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      this.alPulsarEscape();
      campo.blur();
    }
  }

  protected seleccionar(opcion: OpcionCursoBusqueda, evento?: Event): void {
    if (evento) evento.preventDefault();
    this.cerradoManual.set(true);
    this.escribiendo.set(false);
    this.consulta.set('');
    this.indiceActivo.set(-1);

    this.seleccion.emit(opcion.id);
    this.cursoSeleccionado.emit(opcion);
  }

  protected limpiar(campo: HTMLInputElement, evento?: Event): void {
    if (evento) {
      evento.preventDefault();
      evento.stopPropagation();
    }
    this.consulta.set('');
    this.escribiendo.set(false);
    this.cerradoManual.set(true);
    this.indiceActivo.set(-1);
    campo.value = '';
    this.terminoCambio.emit('');
    this.seleccion.emit(null);
    this.cursoSeleccionado.emit(null);
  }

  protected alClickVerTodos(evento: Event): void {
    evento.preventDefault();
    this.ejecutarBuscarTodos();
  }

  private ejecutarBuscarTodos(): void {
    const q = this.consulta().trim();
    this.cerradoManual.set(true);
    this.escribiendo.set(false);
    this.indiceActivo.set(-1);
    this.buscarTodos.emit(q);
  }

  protected alSalir(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!this.elemento.nativeElement.contains(destino)) {
      this.enfocado.set(false);
      this.escribiendo.set(false);
      this.indiceActivo.set(-1);
    }
  }

  protected alHacerClickFuera(evento: MouseEvent): void {
    if (!this.elemento.nativeElement.contains(evento.target as Node)) {
      this.enfocado.set(false);
      this.escribiendo.set(false);
      this.indiceActivo.set(-1);
    }
  }

  protected alPulsarEscape(): void {
    this.cerradoManual.set(true);
    this.escribiendo.set(false);
    this.indiceActivo.set(-1);
  }

  private desplazarAOpcion(idx: number): void {
    setTimeout(() => {
      const contenedor = this.elemento.nativeElement.querySelector('.desplegable-sugerencias');
      const items = this.elemento.nativeElement.querySelectorAll('.lista-opciones li, .ver-todos');
      const item = items[idx] as HTMLElement | undefined;
      if (contenedor && item) {
        const cTop = contenedor.scrollTop;
        const cBottom = cTop + contenedor.clientHeight;
        const iTop = item.offsetTop;
        const iBottom = iTop + item.offsetHeight;
        if (iTop < cTop) {
          contenedor.scrollTop = iTop;
        } else if (iBottom > cBottom) {
          contenedor.scrollTop = iBottom - contenedor.clientHeight;
        }
      }
    }, 0);
  }
}
