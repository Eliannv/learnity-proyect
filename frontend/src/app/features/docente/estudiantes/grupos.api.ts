import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { GruposCurso, DatosGrupo, GrupoCurso } from '../../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class GruposApi {
  private readonly http = inject(HttpClient);
  private url(curso: number) {
    return `${environment.apiUrl}/docente/cursos/${curso}/grupos`;
  }
  listar(curso: number) {
    return firstValueFrom(this.http.get<GruposCurso>(this.url(curso)));
  }
  guardar(curso: number, grupo: GrupoCurso | null, datos: DatosGrupo) {
    return firstValueFrom(
      grupo
        ? this.http.put<GruposCurso>(this.url(curso) + '/' + grupo.id, { ...datos, revision: grupo.revision })
        : this.http.post<GruposCurso>(this.url(curso), datos),
    );
  }
  quitar(curso: number, id: number) {
    return firstValueFrom(this.http.delete<GruposCurso>(this.url(curso) + '/' + id));
  }
}
