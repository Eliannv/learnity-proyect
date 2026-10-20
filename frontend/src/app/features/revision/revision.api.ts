import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CursoDetalle,
  DecisionRevision,
  ListaCursos,
} from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class RevisionApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  colaRevision(): Promise<ListaCursos> {
    return firstValueFrom(
      this.http.get<ListaCursos>(`${this.base}/admin/cursos`, {
        params: { estado: 'EN_REVISION' },
      }),
    );
  }

  detalleAdmin(id: number): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.get<CursoDetalle>(`${this.base}/admin/cursos/${id}`),
    );
  }

  decidir(id: number, datos: DecisionRevision): Promise<CursoDetalle> {
    return firstValueFrom(
      this.http.put<CursoDetalle>(
        `${this.base}/admin/cursos/${id}/revision`,
        datos,
      ),
    );
  }
}
