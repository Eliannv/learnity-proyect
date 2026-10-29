import { Component, inject } from '@angular/core';
import { ListadoCursos } from '../../componentes/listado-cursos';
import { DocenteCursosApi } from '../../docente-cursos.api';

@Component({
  selector: 'app-mis-cursos-docente',
  imports: [ListadoCursos],
  templateUrl: './mis-cursos.html',
  styleUrl: './mis-cursos.scss',
})
export class MisCursosDocente {
  private readonly api = inject(DocenteCursosApi);
  protected readonly cargarMisCursos = () => this.api.misCursos();
}
