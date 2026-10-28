import { Esqueleto } from '../../../shared/ui/esqueleto';
import {
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type CursoResumen,
  type EstadoCurso,
  esEditable,
} from '../../../core/cursos/gestion-cursos.model';
import type { ListaCursos } from '../../../core/api/contrato';
import { Peticion } from '../../../core/estado/peticion';
import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';

@Component({
  selector: 'app-listado-cursos',
  imports: [Esqueleto, RouterLink, EstadoCursoBadge],
  templateUrl: './listado-cursos.html',
  styleUrl: './listado-cursos.scss',
})
export class ListadoCursos {
  readonly admin = input(false);
  readonly cargarCursos = input.required<() => Promise<ListaCursos>>();

  protected readonly p = new Peticion();
  protected readonly editable = esEditable;
  protected readonly filtro = signal<EstadoCurso | 'TODOS'>('TODOS');

  private readonly cursos = signal<CursoResumen[]>([]);
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
  ];

  protected readonly visibles = computed(() =>
    this.cursos().filter((curso) =>
      this.admin()
        ? curso.estado === 'EN_REVISION'
        : this.filtro() === 'TODOS' || curso.estado === this.filtro(),
    ),
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
    if (this.admin()) return 'Revisar curso';
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
      default:
        return '';
    }
  }
}
