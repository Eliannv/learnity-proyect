import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/http/error-api';
import { AprendizajeApi, type CursoInscrito } from '../../aprendizaje.api';
import { AnilloProgreso } from '../../../../shared/ui/datos/anillo-progreso';
import { BarraProgreso } from '../../../../shared/ui/datos/barra-progreso';
import { PortadaCurso } from '../../../../shared/ui/cursos/portada-curso';

type FiltroProgreso = '' | 'en-curso' | 'sin-empezar' | 'completados';
type Orden = 'reciente' | 'avance' | 'titulo';

/** Cursos realmente inscritos: la API conserva el avance entre sesiones. */
@Component({
  selector: 'app-mi-aprendizaje',
  imports: [Esqueleto, RouterLink, LucideAngularModule, AnilloProgreso, BarraProgreso, PortadaCurso],
  templateUrl: './mi-aprendizaje.html',
  styleUrl: './mi-aprendizaje.scss',
})
export class MiAprendizaje {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AprendizajeApi);
  private readonly router = inject(Router);
  private solicitud = 0;

  protected readonly cursos = signal<CursoInscrito[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly reintento = signal(0);
  protected readonly navegando = signal<number | null>(null);
  protected readonly errorNavegacion = signal('');
  protected readonly categoria = signal('');
  protected readonly progreso = signal<FiltroProgreso>('');
  protected readonly docente = signal('');
  protected readonly busqueda = signal('');
  protected readonly orden = signal<Orden>('reciente');

  protected readonly categorias = computed(() => [...new Set(this.cursos().map((i) => i.curso.categoria.nombre))].sort());
  protected readonly docentes = computed(() => [...new Set(this.cursos().map((i) => i.curso.docente))].sort());
  protected readonly totalLecciones = computed(() => this.cursos().reduce((s, c) => s + c.totalLecciones, 0));
  protected readonly completadas = computed(() => this.cursos().reduce((s, c) => s + c.leccionesCompletadas, 0));
  protected readonly principal = computed(() => this.cursos().find((c) => c.inscripcion.estado !== 'COMPLETADA') ?? null);
  protected readonly hayFiltros = computed(() => !!(this.categoria() || this.progreso() || this.docente() || this.busqueda().trim()));
  protected readonly lista = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase('es');
    const cursos = this.cursos().filter((i) =>
      (!this.categoria() || i.curso.categoria.nombre === this.categoria()) &&
      (!this.docente() || i.curso.docente === this.docente()) &&
      (!q || i.curso.titulo.toLocaleLowerCase('es').includes(q)) &&
      (this.progreso() === '' ||
        (this.progreso() === 'en-curso' && i.inscripcion.progresoPct > 0 && i.inscripcion.estado !== 'COMPLETADA') ||
        (this.progreso() === 'sin-empezar' && i.inscripcion.progresoPct === 0) ||
        (this.progreso() === 'completados' && i.inscripcion.estado === 'COMPLETADA')),
    );
    if (this.orden() === 'avance') return [...cursos].sort((a, b) => b.inscripcion.progresoPct - a.inscripcion.progresoPct);
    if (this.orden() === 'titulo') return [...cursos].sort((a, b) => a.curso.titulo.localeCompare(b.curso.titulo, 'es'));
    return [...cursos].sort((a, b) => Date.parse(b.inscripcion.inscritoEn) - Date.parse(a.inscripcion.inscritoEn));
  });

  constructor() {
    effect(() => {
      this.reintento();
      void this.cargar();
    });
  }

  private async cargar(): Promise<void> {
    const actual = ++this.solicitud;
    this.cargando.set(true);
    this.error.set('');
    try {
      const respuesta = await this.api.listar();
      if (actual === this.solicitud) this.cursos.set(respuesta.items);
    } catch (error) {
      if (actual === this.solicitud) this.error.set(mensajeDeError(error, 'Cargar tus cursos'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  protected async abrir(curso: CursoInscrito): Promise<void> {
    if (this.navegando() !== null) return;
    this.navegando.set(curso.curso.id);
    this.errorNavegacion.set('');
    try {
      const detalle = await this.api.detalle(curso.curso.id);
      const primera = detalle.modulos.flatMap((modulo) => modulo.lecciones)[0];
      const id = detalle.inscripcion.ultimaLeccionId ?? primera?.id;
      await this.router.navigate(id ? ['/aprender', curso.curso.id, id] : ['/cursos', curso.curso.id]);
    } catch (error) {
      this.errorNavegacion.set(mensajeDeError(error, 'Abrir el curso'));
    } finally {
      this.navegando.set(null);
    }
  }

  protected reintentar(): void { this.reintento.update((n) => n + 1); }
  protected valor(evento: Event): string { return (evento.target as HTMLInputElement | HTMLSelectElement).value; }
  protected quitarFiltros(): void {
    this.categoria.set(''); this.progreso.set(''); this.docente.set(''); this.busqueda.set('');
  }
  protected tono(id: number): 1 | 2 | 3 { return id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2; }
}
