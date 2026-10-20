import { TitleCasePipe } from '@angular/common';
import {
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { CursoDetalle } from '../../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../../core/estado/peticion';
import { EstadoCursoBadge } from '../../../../shared/ui/estado-curso';
import { ContenidoApi } from '../../../contenido/contenido.api';
import { ArbolTemario } from '../../../docente-cursos/componentes/arbol-temario';
import { RevisionApi } from '../../revision.api';

@Component({
  selector: 'app-revision-curso',
  imports: [
    FormsModule,
    RouterLink,
    TitleCasePipe,
    EstadoCursoBadge,
    ArbolTemario,
  ],
  templateUrl: './revision-curso.html',
  styleUrl: './revision-curso.scss',
})
export class RevisionCurso {
  readonly id = input.required<string>();

  protected readonly carga = new Peticion();
  protected readonly p = new Peticion();

  protected readonly curso = signal<CursoDetalle | null>(null);
  protected readonly descargando = signal(false);

  protected motivo = '';

  private readonly api = inject(RevisionApi);
  private readonly contenidoApi = inject(ContenidoApi);
  private version = 0;

  protected readonly subirArchivoFn = (leccionId: number, archivo: File) =>
    this.contenidoApi.subirPdf(leccionId, archivo);

  protected readonly descargarArchivoFn = (archivoId: number) =>
    this.contenidoApi.descargarPdf(archivoId);

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        void this.cargar();
      });
    });
  }

  protected async cargar(): Promise<void> {
    const version = ++this.version;
    const id = Number(this.id());

    this.curso.set(null);
    this.motivo = '';
    this.descargando.set(false);
    this.carga.limpiar();
    this.p.limpiar();
    this.carga.ocupada.set(true);

    try {
      if (!Number.isInteger(id) || id <= 0) {
        this.carga.error.set('El identificador del curso no es válido.');
        return;
      }

      const detalle = await this.api.detalleAdmin(id);
      if (version === this.version) {
        this.curso.set(detalle);
      }
    } catch (error) {
      if (version === this.version) {
        this.carga.fallar(error);
      }
    } finally {
      if (version === this.version) {
        this.carga.ocupada.set(false);
      }
    }
  }

  protected async decidir(decision: 'APROBAR' | 'RECHAZAR'): Promise<void> {
    const c = this.curso();
    if (!c || this.p.ocupada() || this.descargando()) return;

    const motivo = this.motivo.trim();

    if (decision === 'RECHAZAR' && !motivo) {
      this.p.campos.set({
        motivo: 'Escribe el motivo del rechazo.',
      });
      return;
    }

    const confirmado = confirm(
      decision === 'APROBAR'
        ? '¿Aprobar y publicar este curso en el catálogo?'
        : '¿Rechazar el curso con el motivo indicado?',
    );
    if (!confirmado) return;

    await this.p.ejecutar(
      () =>
        this.api.decidir(
          c.id,
          decision === 'APROBAR'
            ? { decision: 'APROBAR' }
            : { decision: 'RECHAZAR', motivo },
        ),
      (actualizado) => {
        this.curso.set(actualizado);
        this.motivo = '';
      },
      decision === 'APROBAR'
        ? 'Curso publicado en el catálogo.'
        : 'Curso devuelto al docente con el motivo indicado.',
    );
  }
}
