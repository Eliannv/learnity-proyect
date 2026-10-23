import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SeguimientoDocente } from '../../core/api/contrato';

@Injectable({ providedIn: 'root' })
export class SeguimientoDocenteApi {
  private readonly http = inject(HttpClient);

  listar(cursoId: number, pagina: number, limite = 20): Promise<SeguimientoDocente> {
    const params = new HttpParams().set('pagina', pagina).set('limite', limite);
    return firstValueFrom(
      this.http.get<SeguimientoDocente>(
        `${environment.apiUrl}/docente/cursos/${cursoId}/estudiantes`,
        { params },
      ),
    );
  }
}
