import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { CATEGORIAS, CATEGORIAS_ADMIN, CURSOS, MIS_CURSOS, type TipoLeccion } from '../../../data/datos-demo';
import { Avatar } from '../../../shared/ui/avatar';
import { BarraProgreso } from '../../../shared/ui/barra-progreso';
import { Carrusel } from '../../../shared/ui/carrusel';
import { PortadaCurso } from '../../../shared/ui/portada-curso';
import { TarjetaCurso } from '../../../shared/ui/tarjeta-curso';

type Pestana = 'populares' | 'nuevos' | 'avanzados';

const ICONO_TIPO: Record<TipoLeccion, string> = {
  VIDEO: 'play',
  DOCUMENTO: 'file-text',
  PRESENTACION: 'presentation',
  EVALUACION: 'list-checks',
};

/**
 * Inicio con sesión (para todos los roles): retomar lo que se estaba viendo,
 * recomendaciones según los cursos inscritos, destacados y categorías.
 * El visitante ve la portada pública (pages/publico/inicio).
 */
@Component({
  selector: 'app-inicio-estudiante',
  imports: [RouterLink, LucideAngularModule, Avatar, BarraProgreso, Carrusel, PortadaCurso, TarjetaCurso],
  templateUrl: './inicio-estudiante.html',
  styleUrl: './inicio-estudiante.scss',
})
export class InicioEstudiante {
  protected readonly auth = inject(AuthService);
  protected readonly categorias = CATEGORIAS;
  protected readonly iconoTipo = ICONO_TIPO;

  /** Sprint 3: GET /api/mis-cursos (última lección de cada inscripción activa). */
  protected readonly continuar = MIS_CURSOS.filter((i) => !i.completado);

  private readonly inscritos = new Set(MIS_CURSOS.map((i) => i.curso.id));
  private readonly disponibles = CURSOS.filter((c) => !this.inscritos.has(c.id));

  /** Recomendaciones: cursos publicados en los que aún no está inscrito. */
  protected readonly recomendados = [...this.disponibles].sort((a, b) => Number(!!b.nuevo) - Number(!!a.nuevo));

  /** "Porque estudias…": la categoría del curso con actividad más reciente. */
  protected readonly categoriaPrincipal = MIS_CURSOS[0]?.curso.categoria ?? 'Programación';
  protected readonly porCategoria = this.disponibles.filter((c) => c.categoria === this.categoriaPrincipal);

  protected readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'populares', texto: 'Más populares' },
    { id: 'nuevos', texto: 'Nuevos' },
    { id: 'avanzados', texto: 'Intermedio y avanzado' },
  ];
  protected readonly pestana = signal<Pestana>('populares');
  protected readonly destacados = computed(() => {
    switch (this.pestana()) {
      case 'nuevos':
        return CURSOS.filter((c) => c.nuevo);
      case 'avanzados':
        return CURSOS.filter((c) => c.nivel !== 'Principiante');
      default:
        return CURSOS.filter((c) => !c.nuevo);
    }
  });

  /** Solo categorías activas (las inactivas no se muestran a los estudiantes). */
  protected readonly temas = CATEGORIAS_ADMIN.filter((c) => c.activa);

  protected duracion(c: { lecciones: number; minutos: number }): string {
    return `${c.lecciones} lecciones · ${c.minutos} min`;
  }
}
