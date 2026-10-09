import { Component, computed, input } from '@angular/core';
import type { EstadoCurso } from '../../data/datos-demo';

const TEXTO: Record<EstadoCurso, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  PUBLICADO: 'Publicado',
  RECHAZADO: 'Rechazado',
  ARCHIVADO: 'Archivado',
};

const CLASE: Record<EstadoCurso, string> = {
  BORRADOR: 'estado-borrador',
  EN_REVISION: 'estado-revision',
  PUBLICADO: 'estado-publicado',
  RECHAZADO: 'estado-rechazado',
  ARCHIVADO: 'estado-borrador',
};

/** Etiqueta del estado de un curso (BORRADOR → EN_REVISION → PUBLICADO / RECHAZADO → ARCHIVADO). */
@Component({
  selector: 'app-estado-curso',
  template: `<span class="estado" [class]="clase()">{{ texto() }}</span>`,
})
export class EstadoCursoBadge {
  readonly estado = input.required<EstadoCurso>();
  protected readonly texto = computed(() => TEXTO[this.estado()]);
  protected readonly clase = computed(() => `estado ${CLASE[this.estado()]}`);
}
