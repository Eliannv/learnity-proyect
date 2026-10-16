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

import { GestionCursosApi } from '../../../core/cursos/gestion-cursos.api';
import {
  CursoDetalle,
  DecisionRevision,
} from '../../../core/cursos/gestion-cursos.model';

import { EstadoCursoBadge } from '../../../shared/ui/estado-curso';
import { TemarioCurso } from '../../../shared/cursos/temario-curso';
import { Peticion } from '../../../shared/cursos/peticion';

@Component({
  selector: 'app-revision-curso',
  imports: [
    FormsModule,
    RouterLink,
    EstadoCursoBadge,
    TemarioCurso,
  ],
  templateUrl: './revision-curso.html',
  styleUrl: './revision-curso.scss',
})
export class RevisionCurso {
  readonly id = input.required<string>();

  private readonly api = inject(GestionCursosApi);

  protected readonly curso = signal<CursoDetalle | null>(null);

  protected readonly carga = new Peticion();
  protected readonly p = new Peticion();

  protected readonly descargando = signal(false);

  protected motivo = '';

  private version = 0;

  constructor() {
    effect(() => {
      const id = this.id();

      untracked(() => {
        void this.cargar(id);
      });
    });
  }

  protected async cargar(id = this.id()): Promise<void> {
    const version = ++this.version;

    this.curso.set(null);
    this.carga.limpiar();
    this.p.limpiar();
    this.motivo = '';

    this.carga.ocupada.set(true);

    try {
      if (!/^[1-9]\d*$/.test(id)) {
        throw new Error('ID inválido');
      }

      const curso = await this.api.detalleAdmin(Number(id));

      if (version === this.version) {
        this.curso.set(curso);
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

  protected async decidir(
    decision: 'APROBAR' | 'RECHAZAR',
  ): Promise<void> {
    const curso = this.curso();

    if (
      !curso ||
      curso.estado !== 'EN_REVISION' ||
      this.p.ocupada() ||
      this.descargando() ||
      this.p.requiereRecarga()
    ) {
      return;
    }

    if (
      decision === 'APROBAR' &&
      !curso.validacion.completo
    ) {
      return;
    }

    if (
      decision === 'RECHAZAR' &&
      !this.motivo.trim()
    ) {
      this.p.campos.set({
        motivo:
          'Escribe el motivo para que el docente pueda corregir el curso.',
      });

      return;
    }

    const datos: DecisionRevision =
      decision === 'APROBAR'
        ? { decision }
        : {
            decision,
            motivo: this.motivo.trim(),
          };

    const ruta = this.id();

    await this.p.ejecutar(
      () => this.api.decidir(curso.id, datos),
      (respuesta) => {
        if (this.id() === ruta) {
          this.curso.set(respuesta);
        }
      },
      decision === 'APROBAR'
        ? 'Curso publicado.'
        : 'Curso rechazado y devuelto al docente.',
    );
  }
}