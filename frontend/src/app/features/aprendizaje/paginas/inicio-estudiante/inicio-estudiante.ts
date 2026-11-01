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
import { metaCurso } from '../../../../shared/ui/cursos/formato-curso';
import { TarjetaCurso } from '../../../../shared/ui/cursos/tarjeta-curso';
import type { Tono } from '../../../../shared/ui/tipos-ui';
import { mensajeDeError } from '../../../../core/http/error-api';
import {
  CURSO_SIN_LECCIONES,
  leccionParaContinuar,
} from '../../continuar-curso';

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
  protected readonly errorAprendizaje = signal(false);
  protected readonly navegando = signal<number | null>(null);
  protected readonly errorNavegacion = signal('');

  protected readonly cursosInscritos = signal<CursoInscrito[]>([]);
  protected readonly categorias = signal<CategoriaPublica[]>([]);
  protected readonly cursosPopulares = signal<CursoPublico[]>([]);
  protected readonly cursosRecientes = signal<CursoPublico[]>([]);

  /** Cursos en progreso del estudiante (excluye los ya completados al 100%). */
  protected readonly continuar = computed(() =>
    this.cursosInscritos().filter(
      (curso) =>
        curso.inscripcion.estado !== 'COMPLETADA' &&
        !curso.suspendido &&
        curso.totalLecciones > 0,
    ),
  );

  protected readonly mensajeSinPendientes = computed(() => {
    const cursos = this.cursosInscritos();

    if (cursos.length === 0) {
      return {
        icono: 'graduation-cap',
        titulo: 'Empieza a aprender',
        descripcion:
          'Explora el catálogo e inscríbete en un curso. Aquí podrás retomar tus lecciones.',
        ruta: '/cursos',
        accion: 'Explorar cursos',
      };
    }

    if (
      cursos.every(
        (curso) => curso.inscripcion.estado === 'COMPLETADA',
      )
    ) {
      return {
        icono: 'trophy',
        titulo: 'Has terminado tus cursos',
        descripcion:
          'Has completado tus cursos disponibles. Descubre qué aprender después.',
        ruta: '/cursos',
        accion: 'Descubrir cursos',
      };
    }

    if (
      cursos.some(
        (curso) =>
          curso.inscripcion.estado !== 'COMPLETADA' &&
          !curso.suspendido &&
          curso.totalLecciones === 0,
      )
    ) {
      return {
        icono: 'book-open',
        titulo: 'Tus cursos aún no tienen lecciones disponibles',
        descripcion:
          'Conservas tus inscripciones. Revisa su disponibilidad en Mi aprendizaje.',
        ruta: '/mi-aprendizaje',
        accion: 'Ver mi aprendizaje',
      };
    }
  
    return {
      icono: 'circle-pause',
      titulo: 'No tienes cursos disponibles para continuar',
      descripcion:
        'Tus cursos pendientes están suspendidos temporalmente. Revisa su estado en Mi aprendizaje.',
      ruta: '/mi-aprendizaje',
      accion: 'Ver mi aprendizaje',
    };
  });

  protected readonly idsInscritos = computed(() =>
    new Set(this.cursosInscritos().map((i) => i.curso.id))
  );

  /** Recomendaciones: cursos publicados en los que aún no está inscrito. */
  protected readonly recomendados = computed(() => {
    const noInscritos = this.cursosPopulares().filter((c) => !this.idsInscritos().has(c.id));
    return noInscritos.length > 0 ? noInscritos : this.cursosPopulares();
  });

  /** Categoría de un curso activo con actividad registrada. */
  protected readonly categoriaPrincipal = computed(() => {
    if (this.cargando() || this.errorAprendizaje()) return '';
  
    const cursoConActividad = this.continuar().find(
      (curso) =>
        curso.inscripcion.progresoPct > 0 ||
        curso.leccionesCompletadas > 0 ||
        curso.inscripcion.ultimaLeccionId != null,
    );
  
    return cursoConActividad?.curso.categoria.nombre ?? '';
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
    this.errorAprendizaje.set(false);
    try {
      const [inscritos, categorias, populares, recientes] = await Promise.all([
        this.aprendizajeApi.listar().catch(() => {
          this.errorAprendizaje.set(true);
          return { items: [] as CursoInscrito[] };
        }),
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
    this.errorNavegacion.set('');
  
    try {
      const detalle = await this.aprendizajeApi.detalle(curso.curso.id);
      const id = leccionParaContinuar(detalle);
  
      if (id === null) {
        this.errorNavegacion.set(
          `${curso.curso.titulo}: ${CURSO_SIN_LECCIONES}`,
        );
        return;
      }
  
      await this.router.navigate(['/aprender', curso.curso.id, id]);
    } catch (error) {
      this.errorNavegacion.set(mensajeDeError(error, 'Abrir el curso'));
    } finally {
      this.navegando.set(null);
    }
  }

  /** Lecciones y duración disponible. El nivel se muestra en la tarjeta. */
  protected readonly meta = (c: CursoPublico) => metaCurso(c);

  protected tonoDe(id: number): Tono {
    return (id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2) as Tono;
  }
}
