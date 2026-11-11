import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { CategoriaAdmin, DatosCategoria, DatosCategoriaNueva } from '../../../core/api/contrato';
import { CatalogoApi } from '../../catalogo/catalogo.api';

export type { CategoriaAdmin, DatosCategoria, DatosCategoriaNueva } from '../../../core/api/contrato';

/** CRUD de categorías del administrador (ADR-012). No hay borrado: se desactivan. */
@Injectable({ providedIn: 'root' })
export class AdminCategoriasApi {
  private readonly http = inject(HttpClient);
  private readonly catalogo = inject(CatalogoApi);
  private readonly base = `${environment.apiUrl}/admin/categorias`;

  listar(): Promise<CategoriaAdmin[]> {
    return firstValueFrom(this.http.get<CategoriaAdmin[]>(this.base));
  }

  async crear(datos: DatosCategoriaNueva): Promise<CategoriaAdmin> {
    const creada = await firstValueFrom(this.http.post<CategoriaAdmin>(this.base, datos));
    this.catalogo.invalidarCategorias();
    return creada;
  }

  async actualizar(id: number, datos: DatosCategoria): Promise<CategoriaAdmin> {
    const actualizada = await firstValueFrom(this.http.put<CategoriaAdmin>(`${this.base}/${id}`, datos));
    this.catalogo.invalidarCategorias();
    return actualizada;
  }
}
