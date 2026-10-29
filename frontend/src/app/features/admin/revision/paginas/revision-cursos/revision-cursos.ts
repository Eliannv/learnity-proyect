import { Component, inject } from '@angular/core';
import { ListadoCursos } from '../../../../docente/cursos/componentes/listado-cursos';
import { RevisionApi } from '../../revision.api';

@Component({
  selector: 'app-revision-cursos',
  imports: [ListadoCursos],
  templateUrl: './revision-cursos.html',
  styleUrl: './revision-cursos.scss',
})
export class RevisionCursos {
  private readonly api = inject(RevisionApi);
  protected readonly cargarColaRevision = () => this.api.colaRevision();
}
