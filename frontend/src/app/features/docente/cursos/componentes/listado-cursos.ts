import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import {
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  type CursoResumen,
  type EstadoCurso,
  esEditable,
} from '../../../../core/cursos/gestion-cursos.model';
import type { CursoDelDocente, CursoRevision } from '../../../../core/api/contrato';
import { Peticion } from '../../../../core/estado/peticion';
import { EstadoCursoBadge } from '../../../../shared/ui/cursos/estado-curso';
import { BuscadorCurso } from '../../../../shared/ui/cursos/buscador-curso';
import { Estrellas } from '../../../../shared/ui/datos/estrellas';

/** En «Mis cursos» llegan también inscritos y valoración; en Revisión, inscritos y suspensión. */
type CursoListado = CursoResumen
  & Partial<Pick<CursoDelDocente, 'estudiantes' | 'calificacion'>>
  & Partial<Pick<CursoRevision, 'inscritos' | 'suspension'>>
  & { categoria?: string | null };

/** Minúsculas y sin tildes: «diseño» encuentra «Diseño» y «matematicas», «Matemáticas». */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Texto de la lista vacía en cada pestaña de Revisión de cursos. */
const VACIO_ADMIN: Partial<Record<EstadoCurso, string>> = {
  EN_REVISION: 'No hay cursos pendientes de revisión.',
  PUBLICADO: 'No hay cursos publicados.',
  SUSPENDIDO: 'No hay cursos suspendidos.',
  RECHAZADO: 'No hay cursos rechazados.',
  BORRADOR: 'No hay cursos en borrador.',
};

@Component({
  selector: 'app-listado-cursos',
  imports: [Esqueleto, DecimalPipe, RouterLink, BuscadorCurso, EstadoCursoBadge, Estrellas],
  templateUrl: './listado-cursos.html',
  styleUrl: './listado-cursos.scss',
})
export class ListadoCursos {
  readonly admin = input(false);
  /** En Revisión de cursos, la pestaña elegida: el servidor ya filtra por ella. */
  readonly estadoAdmin = input<EstadoCurso>('EN_REVISION');
  readonly cargarCursos = input.required<() => Promise<{ items: CursoListado[] }>>();

  protected readonly p = new Peticion();
  protected readonly editable = esEditable;
  protected readonly filtro = signal<EstadoCurso | 'TODOS'>('TODOS');
  protected readonly filtroCursoId = signal<number | null>(null);
  protected readonly textoBusqueda = signal('');
  /** Revisión de cursos: buscador por título o docente y filtro por categoría, dentro de la pestaña activa. */
  protected readonly busquedaAdmin = signal('');
  protected readonly categoriaAdmin = signal('');
  protected readonly categoriasAdmin = computed(() =>
    [...new Set(this.cursos().map((c) => c.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'es')));
  /** Las categorías de la pestaña como opciones del selector buscable compartido (id = posición). */
  protected readonly opcionesCategoriaAdmin = computed(() => this.categoriasAdmin().map((titulo, id) => ({ id, titulo })));
  protected readonly idCategoriaAdmin = computed(() => {
    const id = this.categoriasAdmin().indexOf(this.categoriaAdmin());
    return id >= 0 ? id : null;
  });

  protected elegirCategoriaAdmin(id: number | null): void {
    this.categoriaAdmin.set(id === null ? '' : (this.categoriasAdmin()[id] ?? ''));
  }

  readonly cursos = signal<CursoListado[]>([]);
  private readonly portadasFallidas = signal<ReadonlySet<number>>(new Set());
  private version = 0;

  protected readonly filtros: {
    valor: EstadoCurso | 'TODOS';
    texto: string;
  }[] = [
    { valor: 'TODOS', texto: 'Todos' },
    { valor: 'BORRADOR', texto: 'Borradores' },
    { valor: 'EN_REVISION', texto: 'En revisión' },
    { valor: 'RECHAZADO', texto: 'Rechazados' },
    { valor: 'PUBLICADO', texto: 'Publicados' },
    { valor: 'SUSPENDIDO', texto: 'Suspendidos' },
  ];

  protected readonly visibles = computed(() => {
    let lista = this.cursos();
    // La categoría filtra igual en Revisión (admin) y en Mis cursos (docente).
    const cat = normalizar(this.categoriaAdmin());
    if (cat) lista = lista.filter((c) => normalizar(c.categoria ?? '') === cat);
    if (this.admin()) {
      const q = normalizar(this.busquedaAdmin());
      if (q) lista = lista.filter((c) => normalizar(c.titulo).includes(q) || normalizar(c.docente).includes(q));
    } else {
      if (this.filtro() !== 'TODOS') {
        lista = lista.filter((curso) => curso.estado === this.filtro());
      }
      if (this.filtroCursoId() !== null) {
        lista = lista.filter((curso) => curso.id === this.filtroCursoId());
      } else if (this.textoBusqueda().trim()) {
        const q = this.textoBusqueda().trim().toLowerCase();
        lista = lista.filter((curso) => curso.titulo.toLowerCase().includes(q));
      }
    }
    return lista;
  });

  protected readonly textoVacio = computed(() =>
    this.admin()
      ? (this.busquedaAdmin().trim() || this.categoriaAdmin().trim()) && this.cursos().length
        ? 'Ningún curso de esta pestaña coincide con los filtros.'
        : VACIO_ADMIN[this.estadoAdmin()] ?? 'No hay cursos en este estado.'
      : 'No tienes cursos en este estado. Puedes crear un curso nuevo.',
  );

  constructor() {
    effect(() => {
      this.admin();
      this.cargarCursos();
      untracked(() => {
        void this.cargar();
      });
    });
  }

  protected alSeleccionarCurso(id: number | null): void {
    this.filtroCursoId.set(id);
  }

  protected alCambiarTermino(termino: string): void {
    this.textoBusqueda.set(termino);
  }

  protected async cargar(): Promise<void> {
    const version = ++this.version;
    this.cursos.set([]);
    this.p.limpiar();
    this.p.ocupada.set(true);

    try {
      const respuesta = await this.cargarCursos()();
      if (version === this.version) {
        this.cursos.set(respuesta.items);
      }
    } catch (error) {
      if (version === this.version) {
        this.p.fallar(error);
      }
    } finally {
      if (version === this.version) {
        this.p.ocupada.set(false);
      }
    }
  }

  protected etiquetaAccion(curso: CursoResumen): string {
    if (this.admin()) return curso.estado === 'EN_REVISION' ? 'Revisar curso' : 'Ver curso';
    switch (curso.estado) {
      case 'BORRADOR':
        return 'Continuar editando';
      case 'RECHAZADO':
        return 'Corregir curso';
      case 'EN_REVISION':
        return 'Consultar curso';
      case 'PUBLICADO':
        return 'Editar curso';
      default:
        return this.editable(curso.estado) ? 'Editar curso' : 'Ver curso';
    }
  }

  protected portadaFallida(id: number): boolean {
    return this.portadasFallidas().has(id);
  }

  protected marcarPortadaFallida(id: number): void {
    this.portadasFallidas.update((ids) => new Set(ids).add(id));
  }

  protected inicial(titulo: string): string {
    return titulo.trim().charAt(0).toUpperCase() || '?';
  }

  protected descripcionEstado(estado: EstadoCurso): string {
    switch (estado) {
      case 'BORRADOR':
        return 'En preparación · Completa la ficha, módulos y documentos para enviar a revisión.';
      case 'EN_REVISION':
        return 'En evaluación administrativa · El curso está en cola de revisión y no admite cambios.';
      case 'RECHAZADO':
        return 'Requiere ajustes según las observaciones administrativas para reenviarse.';
      case 'PUBLICADO':
        return 'Curso activo en el catálogo. Puedes seguir editándolo: los cambios se publican sin nueva revisión.';
      case 'SUSPENDIDO':
        return 'Suspendido por la administración: no aparece en el catálogo, sus estudiantes no pueden abrirlo y no admite cambios.';
      default:
        return '';
    }
  }
}
