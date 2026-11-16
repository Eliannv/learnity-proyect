import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { metaCurso } from '../../../../shared/ui/cursos/formato-curso';
import { TarjetaCurso } from '../../../../shared/ui/cursos/tarjeta-curso';
import type { Tono } from '../../../../shared/ui/tipos-ui';

type Pestana = 'populares' | 'nuevos' | 'avanzados';

/**
 * Inicio con sesión (para todos los roles): retomar lo que se estaba viendo,
 * recomendaciones según los cursos inscritos, destacados y categorías.
 * El visitante ve la portada pública (features/catalogo/paginas/inicio).
 */
@Component({
  selector: 'app-inicio-estudiante',
  imports: [RouterLink, LucideAngularModule, Avatar, BarraProgreso, Carrusel, TarjetaCurso],
  templateUrl: './inicio-estudiante.html',
  styleUrl: './inicio-estudiante.scss',
})
export class InicioEstudiante {
  protected readonly auth = inject(AuthService);
  private readonly aprendizajeApi = inject(AprendizajeApi);
  private readonly catalogoApi = inject(CatalogoApi);
  protected readonly cargando = signal(true);

  protected readonly cursosInscritos = signal<CursoInscrito[]>([]);
  protected readonly categorias = signal<CategoriaPublica[]>([]);
  protected readonly cursosPopulares = signal<CursoPublico[]>([]);
  protected readonly cursosRecientes = signal<CursoPublico[]>([]);

  /** Cursos en progreso del estudiante (excluye los ya completados al 100%). */
  protected readonly continuar = computed(() =>
    // Un curso suspendido (D2) no se puede abrir: se ve solo en «Mi aprendizaje», con su aviso.
    this.cursosInscritos().filter((i) => i.inscripcion.estado !== 'COMPLETADA' && !i.suspendido)
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

  /** Retomar: la última lección abierta; sin ella (curso sin empezar), la ficha del curso con su botón «Empezar». */
  protected enlaceRetomar(i: CursoInscrito): string {
    const ultima = i.inscripcion.ultimaLeccionId;
    return ultima ? `/aprender/${i.curso.id}/${ultima}` : `/cursos/${i.curso.id}`;
  }

  /** Nivel, lecciones y duración (sin «0 min»). */
  protected readonly meta = (c: CursoPublico) => metaCurso(c, true);

  protected tonoDe(id: number): Tono {
    return (id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2) as Tono;
  }
}
