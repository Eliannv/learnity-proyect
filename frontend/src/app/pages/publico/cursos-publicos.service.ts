import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type NivelCurso = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
export type OrdenCatalogo = 'recientes' | 'populares' | 'az';
export type TipoLeccionPublica = 'VIDEO' | 'DOCUMENTO' | 'EVALUACION';

export interface CategoriaPublica {
  id: number;
  nombre: string;
}

export interface CursoPublico {
  id: number;
  titulo: string;
  subtitulo: string | null;
  categoria: CategoriaPublica;
  docente: string;
  nivel: NivelCurso;
  portadaUrl: string | null;
  modulos: number;
  lecciones: number;
  minutos: number;
  publicadoEn: string;
  estado: 'PUBLICADO';
}

export interface LeccionPublica {
  id: number;
  orden: number;
  titulo: string;
  tipo: TipoLeccionPublica;
  minutos: number;
}

export interface ModuloPublico {
  id: number;
  orden: number;
  titulo: string;
  lecciones: LeccionPublica[];
}

export interface DetalleCursoPublico extends CursoPublico {
  descripcion: string;
  docenteBio: string | null;
  objetivos: string[];
  requisitos: string[];
  temario: ModuloPublico[];
}

export interface FiltrosCatalogo {
  q?: string;
  categorias?: string[];
  niveles?: NivelCurso[];
  orden: OrdenCatalogo;
  pagina: number;
  limite: number;
}

export interface PaginaCursos {
  items: CursoPublico[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

/** La API pública solo debe devolver PUBLICADO. El filtro local evita mostrar un borrador ante una regresión del servidor. */
@Injectable({ providedIn: 'root' })
export class CursosPublicosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  categorias(): Promise<CategoriaPublica[]> {
    return firstValueFrom(this.http.get<CategoriaPublica[]>(`${this.api}/categorias`));
  }

  async catalogo(filtros: FiltrosCatalogo): Promise<PaginaCursos> {
    let params = new HttpParams()
      .set('pagina', filtros.pagina)
      .set('limite', filtros.limite)
      .set('orden', filtros.orden);
    if (filtros.q?.trim()) params = params.set('q', filtros.q.trim());
    for (const categoria of filtros.categorias ?? []) params = params.append('categoria', categoria);
    for (const nivel of filtros.niveles ?? []) params = params.append('nivel', nivel);
    const respuesta = await firstValueFrom(this.http.get<PaginaCursos>(`${this.api}/cursos`, { params }));
    return { ...respuesta, items: respuesta.items.filter((curso) => curso.estado === 'PUBLICADO') };
  }

  async detalle(id: string): Promise<DetalleCursoPublico | null> {
    const curso = await firstValueFrom(this.http.get<DetalleCursoPublico>(`${this.api}/cursos/${encodeURIComponent(id)}`));
    return curso.estado === 'PUBLICADO' ? curso : null;
  }
}
