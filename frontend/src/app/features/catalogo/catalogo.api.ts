import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CategoriaPublica,
  CursoPublico,
  CursoPublicoDetalle,
  LeccionPublica,
  ModuloPublico,
  NivelCursoPublico,
  OrdenCatalogo,
  PaginaCatalogo,
  TipoLeccionPublica,
  VistaPreviaVideo,
} from '../../core/api/contrato';

export type {
  CategoriaPublica,
  CursoPublico,
  CursoPublicoDetalle,
  LeccionPublica,
  ModuloPublico,
  NivelCursoPublico,
  OrdenCatalogo,
  PaginaCatalogo,
  TipoLeccionPublica,
  VistaPreviaVideo,
};
export type NivelCurso = NivelCursoPublico;
export type PaginaCursos = PaginaCatalogo;
export type DetalleCursoPublico = CursoPublicoDetalle;

export interface FiltrosCatalogo {
  q?: string;
  categoria?: string[];
  categorias?: string[];
  nivel?: NivelCursoPublico[];
  niveles?: NivelCursoPublico[];
  orden?: OrdenCatalogo;
  pagina?: number;
  limite?: number;
}

const ENTERO_POSITIVO_PG = 2_147_483_647;

function aIdCursoValido(id: string | number): number | null {
  const texto = String(id).trim();
  if (!/^[1-9]\d*$/.test(texto)) return null;
  const n = Number(texto);
  return Number.isSafeInteger(n) && n <= ENTERO_POSITIVO_PG ? n : null;
}

@Injectable({ providedIn: 'root' })
export class CatalogoApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  categorias(): Promise<CategoriaPublica[]> {
    return firstValueFrom(this.http.get<CategoriaPublica[]>(`${this.base}/categorias`));
  }

  async listar(filtros: FiltrosCatalogo = {}): Promise<PaginaCatalogo> {
    let params = new HttpParams();
    if (filtros.q?.trim()) params = params.set('q', filtros.q.trim());
    for (const c of filtros.categorias ?? filtros.categoria ?? []) params = params.append('categoria', c);
    for (const n of filtros.niveles ?? filtros.nivel ?? []) params = params.append('nivel', n);
    if (filtros.orden) params = params.set('orden', filtros.orden);
    if (filtros.pagina) params = params.set('pagina', String(filtros.pagina));
    if (filtros.limite) params = params.set('limite', String(filtros.limite));
    const respuesta = await firstValueFrom(
      this.http.get<PaginaCatalogo>(`${this.base}/cursos`, { params }),
    );
    return {
      ...respuesta,
      items: respuesta.items.filter((c) => !('estado' in c) || c.estado === 'PUBLICADO'),
    };
  }

  catalogo(filtros: FiltrosCatalogo = {}): Promise<PaginaCatalogo> {
    return this.listar(filtros);
  }

  async detalle(id: string | number): Promise<DetalleCursoPublico | null> {
    const idValido = aIdCursoValido(id);
    if (!idValido) return null;
    const curso = await firstValueFrom(
      this.http.get<DetalleCursoPublico>(`${this.base}/cursos/${idValido}`),
    );
    if ('estado' in curso && curso.estado !== 'PUBLICADO') return null;
    return curso;
  }

  videoVistaPrevia(idLeccion: number): Promise<VistaPreviaVideo> {
    const idValido = aIdCursoValido(idLeccion);
    if (!idValido) return Promise.reject(new Error('La lección no es válida.'));
    return firstValueFrom(
      this.http.get<VistaPreviaVideo>(`${this.base}/lecciones/${idValido}/video-preview`),
    );
  }
}

export { CatalogoApi as CursosPublicosService };
