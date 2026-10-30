import { Esqueleto } from '../../../../../shared/ui/retroalimentacion/esqueleto';
import { DatePipe, TitleCasePipe } from '@angular/common';
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
import type { CursoDetalle } from '../../../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../../../core/estado/peticion';
import { EstadoCursoBadge } from '../../../../../shared/ui/cursos/estado-curso';
import { ContenidoApi } from '../../../../contenido/contenido.api';
import { ArbolTemario } from '../../../../docente/cursos/componentes/arbol-temario';
import { DocenteCursosApi } from '../../../../docente/cursos/cursos.api';
import { RevisionApi } from '../../revision.api';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';

@Component({
  selector: 'app-revision-curso',
  imports: [Esqueleto, 
    FormsModule,
    RouterLink,
    TitleCasePipe,
    DatePipe,
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
  /** Suspensión de un curso publicado: motivo y casilla «Confirmo». */
  protected motivoSuspension = '';
  protected confirmo = false;

  private readonly api = inject(RevisionApi);
  private readonly contenidoApi = inject(ContenidoApi);
  private readonly docenteApi = inject(DocenteCursosApi);
  private readonly confirmacion = inject(ConfirmacionService);
  private version = 0;

  protected readonly subirArchivoFn = (leccionId: number, archivo: File) =>
    this.contenidoApi.subirPdf(leccionId, archivo);

  protected readonly descargarArchivoFn = (archivoId: number) =>
    this.contenidoApi.descargarPdf(archivoId);

  /** El administrador consulta las preguntas (con su respuesta correcta) antes de decidir. */
  protected readonly cargarCuestionarioFn = (leccionId: number) =>
    this.docenteApi.cuestionario(leccionId);

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
    this.motivoSuspension = '';
    this.confirmo = false;
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

    const confirmado = await this.confirmacion.confirmar(decision === 'APROBAR'
      ? {
          titulo: '¿Aprobar y publicar este curso?',
          mensaje: 'Aparecerá en el catálogo y el docente recibirá un correo con la noticia.',
          accion: 'Aprobar y publicar', icono: 'shield-check',
        }
      : {
          titulo: '¿Rechazar este curso?',
          mensaje: 'El docente recibirá un correo con el motivo y podrá corregirlo y reenviarlo.',
          accion: 'Rechazar curso', peligro: true,
        });
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

  /** PUBLICADO → SUSPENDIDO: exige motivo y la casilla «Confirmo» (también la exige el servidor). */
  protected async suspender(): Promise<void> {
    const c = this.curso();
    if (!c || this.p.ocupada()) return;
    const motivo = this.motivoSuspension.trim();
    const errores: Record<string, string> = {};
    if (!motivo) errores['motivoSuspension'] = 'Escribe el motivo de la suspensión.';
    if (!this.confirmo) errores['confirmo'] = 'Marca «Confirmo» para suspender el curso.';
    if (Object.keys(errores).length) {
      this.p.campos.set(errores);
      return;
    }
    await this.p.ejecutar(
      () => this.api.suspender(c.id, motivo),
      (actualizado) => {
        this.curso.set(actualizado);
        this.motivoSuspension = '';
        this.confirmo = false;
      },
      'Curso suspendido. Ya no aparece en el catálogo y avisamos al docente por correo.',
    );
  }

  /** SUSPENDIDO → PUBLICADO, tras confirmar. */
  protected async reactivar(): Promise<void> {
    const c = this.curso();
    if (!c || this.p.ocupada()) return;
    const confirmado = await this.confirmacion.confirmar({
      titulo: '¿Reactivar este curso?',
      mensaje: 'Volverá al catálogo, sus estudiantes podrán continuar donde lo dejaron y el docente recibirá un correo.',
      accion: 'Reactivar curso',
      icono: 'circle-play',
    });
    if (!confirmado) return;
    await this.p.ejecutar(
      () => this.api.reactivar(c.id),
      (actualizado) => this.curso.set(actualizado),
      'Curso reactivado: vuelve a estar publicado.',
    );
  }
}
