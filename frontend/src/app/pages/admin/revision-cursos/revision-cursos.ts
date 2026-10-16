import { Component } from '@angular/core';

import { ListadoCursos } from '../../../shared/cursos/listado-cursos';

@Component({
  selector: 'app-revision-cursos',
  imports: [ListadoCursos],
  templateUrl: './revision-cursos.html',
  styleUrl: './revision-cursos.scss',
})
export class RevisionCursos {}