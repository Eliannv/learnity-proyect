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
  imports: [RouterLink, EstadoCursoBadge],
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
}
