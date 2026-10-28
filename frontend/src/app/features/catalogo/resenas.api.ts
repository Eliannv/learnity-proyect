import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { DatosResena, MiResena, PaginaResenas, Resena } from '../../core/api/contrato';

export type { DatosResena, MiResena, PaginaResenas, Resena } from '../../core/api/contrato';

/** Reseñas de un curso: lectura pública; escribir exige estar inscrito. */
@Injectable({ providedIn: 'root' })
export class ResenasApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  listar(cursoId: number, pagina = 1, limite = 10): Promise<PaginaResenas> {
    const params = new HttpParams().set('pagina', pagina).set('limite', limite);
    return firstValueFrom(this.http.get<PaginaResenas>(`${this.base}/cursos/${cursoId}/resenas`, { params }));
  }

  mia(cursoId: number): Promise<MiResena> {
    return firstValueFrom(this.http.get<MiResena>(`${this.base}/cursos/${cursoId}/resena`));
  }

  guardar(cursoId: number, datos: DatosResena): Promise<Resena> {
    return firstValueFrom(this.http.put<Resena>(`${this.base}/cursos/${cursoId}/resena`, datos));
  }

  eliminar(cursoId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/cursos/${cursoId}/resena`));
  }
}
