import {
  Component,
  computed,
  input,
} from '@angular/core';

import type {
  EstadoCurso,
} from '../../../core/cursos/gestion-cursos.model';

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

@Component({
  selector: 'app-estado-curso',
  templateUrl: './estado-curso.html',
  styleUrl: './estado-curso.scss',
})
export class EstadoCursoBadge {
  readonly estado = input.required<EstadoCurso>();

  protected readonly texto = computed(
    () => TEXTO[this.estado()],
  );

  protected readonly clase = computed(
    () => `estado ${CLASE[this.estado()]}`,
  );
}