import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ListadoCursos } from '../../../../docente/cursos/componentes/listado-cursos';
import { RevisionApi, type EstadoRevision, type RespuestaRevision } from '../../revision.api';

const PESTANAS: { estado: EstadoRevision; texto: string }[] = [
  { estado: 'EN_REVISION', texto: 'Pendientes de revisión' },
  { estado: 'PUBLICADO', texto: 'Publicados' },
  { estado: 'SUSPENDIDO', texto: 'Suspendidos' },
  { estado: 'RECHAZADO', texto: 'Rechazados' },
  { estado: 'BORRADOR', texto: 'Borradores' },
];

/**
 * Revisión y gobernanza de cursos: una pestaña por estado. La pestaña va en la URL (`?estado=PUBLICADO`) para que
 * «volver» desde el detalle regrese a la misma lista; sin parámetro, los pendientes de revisión.
 */
import { ConmutadorSeccion, SECCION_CURSOS } from '../../../../../shared/ui/navegacion/conmutador-seccion';

@Component({
  selector: 'app-revision-cursos',
  imports: [ListadoCursos, ConmutadorSeccion],
  templateUrl: './revision-cursos.html',
  styleUrl: './revision-cursos.scss',
})
export class RevisionCursos {
  protected readonly seccion = SECCION_CURSOS;
  private readonly api = inject(RevisionApi);
  private readonly router = inject(Router);

  /** Parámetro de consulta `estado` (withComponentInputBinding). */
  readonly estado = input<string>();

  protected readonly pestanas = PESTANAS;
  protected readonly pestana = computed<EstadoRevision>(() =>
    PESTANAS.find((p) => p.estado === this.estado())?.estado ?? 'EN_REVISION');
  protected readonly conteos = signal<RespuestaRevision['conteos'] | null>(null);

  /** Una función nueva por pestaña: el listado vuelve a cargar al cambiarla. */
  protected readonly cargarCursos = computed(() => {
    const estado = this.pestana();
    return async () => {
      const respuesta = await this.api.listar(estado);
      this.conteos.set(respuesta.conteos ?? null);
      return respuesta;
    };
  });

  protected elegir(estado: EstadoRevision): void {
    void this.router.navigate([], { queryParams: { estado: estado === 'EN_REVISION' ? null : estado }, replaceUrl: true });
  }
}
