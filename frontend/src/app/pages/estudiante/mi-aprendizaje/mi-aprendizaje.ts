import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { MIS_CURSOS, MIS_EVALUACIONES, RESUMEN_AVANCE, type CursoInscrito } from '../../../data/datos-demo';
import { AnilloProgreso } from '../../../shared/ui/anillo-progreso';
import { BarraProgreso } from '../../../shared/ui/barra-progreso';
import { PortadaCurso } from '../../../shared/ui/portada-curso';

type Pestana = 'cursos' | 'evaluaciones';
type Progreso = '' | 'en-curso' | 'sin-empezar' | 'completados';
type Orden = 'reciente' | 'avance' | 'titulo';

/**
 * Mi aprendizaje: todos los cursos inscritos con su avance, filtros y búsqueda,
 * y el historial de evaluaciones. Sprint 3: GET /api/mis-cursos · Sprint 4: GET /api/mis-evaluaciones.
 */
@Component({
  selector: 'app-mi-aprendizaje',
  imports: [RouterLink, LucideAngularModule, AnilloProgreso, BarraProgreso, PortadaCurso],
  templateUrl: './mi-aprendizaje.html',
  styleUrl: './mi-aprendizaje.scss',
})
export class MiAprendizaje {
  protected readonly auth = inject(AuthService);

  /** /mi-aprendizaje?vista=evaluaciones abre directamente el historial. */
  readonly vista = input<string>();
  protected readonly pestana = linkedSignal<Pestana>(() => (this.vista() === 'evaluaciones' ? 'evaluaciones' : 'cursos'));

  protected readonly cursos = MIS_CURSOS;
  protected readonly evaluaciones = MIS_EVALUACIONES;
  protected readonly resumen = RESUMEN_AVANCE;
  /** El curso en curso con actividad más reciente: a él apunta el mensaje del resumen. */
  protected readonly principal = MIS_CURSOS.find((i) => !i.completado && i.progreso > 0) ?? null;

  protected readonly categorias = [...new Set(MIS_CURSOS.map((i) => i.curso.categoria))].sort();
  protected readonly docentes = [...new Set(MIS_CURSOS.map((i) => i.curso.docente))].sort();

  protected readonly categoria = signal('');
  protected readonly progreso = signal<Progreso>('');
  protected readonly docente = signal('');
  protected readonly busqueda = signal('');
  protected readonly orden = signal<Orden>('reciente');

  protected readonly hayFiltros = computed(
    () => !!(this.categoria() || this.progreso() || this.docente() || this.busqueda().trim()),
  );

  protected readonly lista = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtrados = MIS_CURSOS.filter(
      (i) =>
        (!this.categoria() || i.curso.categoria === this.categoria()) &&
        (!this.docente() || i.curso.docente === this.docente()) &&
        coincideProgreso(i, this.progreso()) &&
        (!texto || i.curso.titulo.toLowerCase().includes(texto)),
    );
    switch (this.orden()) {
      case 'avance':
        return [...filtrados].sort((a, b) => b.progreso - a.progreso);
      case 'titulo':
        return [...filtrados].sort((a, b) => a.curso.titulo.localeCompare(b.curso.titulo, 'es'));
      default:
        return filtrados;
    }
  });

  protected valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected quitarFiltros() {
    this.categoria.set('');
    this.progreso.set('');
    this.docente.set('');
    this.busqueda.set('');
  }
}

function coincideProgreso(i: CursoInscrito, filtro: Progreso): boolean {
  switch (filtro) {
    case 'en-curso':
      return !i.completado && i.progreso > 0;
    case 'sin-empezar':
      return i.progreso === 0;
    case 'completados':
      return !!i.completado;
    default:
      return true;
  }
}
