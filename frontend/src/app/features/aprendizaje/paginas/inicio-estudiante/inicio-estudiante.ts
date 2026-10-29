import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { AprendizajeApi, type CursoInscrito } from '../../aprendizaje.api';
import {
  CatalogoApi,
  type CategoriaPublica,
  type CursoPublico,
} from '../../../catalogo/catalogo.api';
import { Avatar } from '../../../../shared/ui/marca/avatar';
import { BarraProgreso } from '../../../../shared/ui/datos/barra-progreso';
import { Carrusel } from '../../../../shared/ui/navegacion/carrusel';
import { PortadaCurso } from '../../../../shared/ui/cursos/portada-curso';
import { TarjetaCurso } from '../../../../shared/ui/cursos/tarjeta-curso';
import { ICONO_CATEGORIA, type Tono } from '../../../../shared/ui/tipos-ui';

type Pestana = 'populares' | 'nuevos' | 'avanzados';

/**
 * Inicio con sesión (para todos los roles): retomar lo que se estaba viendo,
 * recomendaciones según los cursos inscritos, destacados y categorías.
 * El visitante ve la portada pública (features/catalogo/paginas/inicio).
 */
@Component({
  selector: 'app-inicio-estudiante',
  imports: [RouterLink, LucideAngularModule, Avatar, BarraProgreso, Carrusel, PortadaCurso, TarjetaCurso],
  templateUrl: './inicio-estudiante.html',
  styleUrl: './inicio-estudiante.scss',
})
export class InicioEstudiante {
  protected readonly auth = inject(AuthService);
  private readonly aprendizajeApi = inject(AprendizajeApi);
  private readonly catalogoApi = inject(CatalogoApi);
  private readonly router = inject(Router);

  protected readonly cargando = signal(true);
  protected readonly navegando = signal<number | null>(null);

  protected readonly cursosInscritos = signal<CursoInscrito[]>([]);
  protected readonly categorias = signal<CategoriaPublica[]>([]);
  protected readonly cursosPopulares = signal<CursoPublico[]>([]);
  protected readonly cursosRecientes = signal<CursoPublico[]>([]);

  /** Cursos en progreso del estudiante (excluye los ya completados al 100%). */
  protected readonly continuar = computed(() =>
    this.cursosInscritos().filter((i) => i.inscripcion.estado !== 'COMPLETADA')
  );

  protected readonly idsInscritos = computed(() =>
    new Set(this.cursosInscritos().map((i) => i.curso.id))
  );

  /** Recomendaciones: cursos publicados en los que aún no está inscrito. */
  protected readonly recomendados = computed(() => {
    const noInscritos = this.cursosPopulares().filter((c) => !this.idsInscritos().has(c.id));
    return noInscritos.length > 0 ? noInscritos : this.cursosPopulares();
  });

  /** "Porque estudias…": la categoría del curso con actividad más reciente. */
  protected readonly categoriaPrincipal = computed(() => {
    return this.cursosInscritos()[0]?.curso.categoria.nombre ?? (this.categorias()[0]?.nombre || '');
  });

  protected readonly porCategoria = computed(() => {
    const cat = this.categoriaPrincipal();
    if (!cat) return [];
    return this.cursosPopulares().filter((c) => c.categoria.nombre === cat && !this.idsInscritos().has(c.id));
  });

  protected readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'populares', texto: 'Más populares' },
    { id: 'nuevos', texto: 'Nuevos' },
    { id: 'avanzados', texto: 'Intermedio y avanzado' },
  ];

  protected readonly pestana = signal<Pestana>('populares');

  protected readonly destacados = computed(() => {
    switch (this.pestana()) {
      case 'nuevos':
        return this.cursosRecientes();
      case 'avanzados':
        return this.cursosPopulares().filter((c) => c.nivel !== 'PRINCIPIANTE');
      default:
        return this.cursosPopulares();
    }
  });

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [inscritos, categorias, populares, recientes] = await Promise.all([
        this.aprendizajeApi.listar().catch(() => ({ items: [] as CursoInscrito[] })),
        this.catalogoApi.categorias().catch(() => [] as CategoriaPublica[]),
        this.catalogoApi.listar({ orden: 'populares', limite: 8 }).catch(() => ({ items: [] as CursoPublico[] })),
        this.catalogoApi.listar({ orden: 'recientes', limite: 8 }).catch(() => ({ items: [] as CursoPublico[] })),
      ]);
      this.cursosInscritos.set(inscritos.items);
      this.categorias.set(categorias);
      this.cursosPopulares.set(populares.items);
      this.cursosRecientes.set(recientes.items);
    } finally {
      this.cargando.set(false);
    }
  }

  protected async abrir(curso: CursoInscrito): Promise<void> {
    if (this.navegando() !== null) return;
    this.navegando.set(curso.curso.id);
    try {
      const detalle = await this.aprendizajeApi.detalle(curso.curso.id);
      const primera = detalle.modulos.flatMap((modulo) => modulo.lecciones)[0];
      const id = detalle.inscripcion.ultimaLeccionId ?? primera?.id;
      await this.router.navigate(id ? ['/aprender', curso.curso.id, id] : ['/cursos', curso.curso.id]);
    } catch {
      await this.router.navigate(['/cursos', curso.curso.id]);
    } finally {
      this.navegando.set(null);
    }
  }

  protected duracion(c: { lecciones: number; minutos?: number }): string {
    const mins = c.minutos ? ` · ${c.minutos} min` : '';
    return `${c.lecciones} lecciones${mins}`;
  }

  protected tonoDe(id: number): Tono {
    return (id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2) as Tono;
  }

  protected iconoDe(categoria: string): string {
    return ICONO_CATEGORIA[categoria] || 'book-open';
  }
}
