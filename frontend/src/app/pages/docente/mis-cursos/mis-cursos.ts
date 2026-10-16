import { Component } from '@angular/core';

import { ListadoCursos } from '../../../shared/cursos/listado-cursos';

@Component({
  selector: 'app-mis-cursos-docente',
  imports: [ListadoCursos],
  templateUrl: './mis-cursos.html',
  styleUrl: './mis-cursos.scss',
})
export class MisCursosDocente {}