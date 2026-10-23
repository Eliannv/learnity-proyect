import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { AprendizajeApi, type CursoInscrito, type DetalleAprendizaje } from '../../../features/aprendizaje/aprendizaje.api';
import { leccionParaContinuar } from '../../../features/catalogo/aprendizaje-navegacion';
import { AnilloProgreso } from '../../../shared/ui/anillo-progreso';
import { PortadaCurso } from '../../../shared/ui/portada-curso';

type FiltroProgreso = '' | 'en-curso' | 'sin-empezar' | 'completados';
type Orden = 'reciente' | 'avance' | 'titulo';

@Component({
  selector: 'app-mi-aprendizaje',
  imports: [RouterLink, LucideAngularModule, AnilloProgreso, PortadaCurso],
  templateUrl: './mi-aprendizaje.html',
  styleUrl: './mi-aprendizaje.scss',
})
export class MiAprendizaje {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AprendizajeApi);
  private readonly router = inject(Router);
  private solicitud = 0;
  private destruido = false;

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
  protected readonly pagina = signal(1);
  protected readonly limite = 12;
  protected readonly detalles = signal(new Map<number, DetalleAprendizaje | null>());

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
  protected readonly totalPaginas = computed(() => Math.ceil(this.lista().length / this.limite));
  protected readonly paginaActual = computed(() => Math.min(this.pagina(), Math.max(1, this.totalPaginas())));
  protected readonly cursosVisibles = computed(() => this.lista().slice(
    (this.paginaActual() - 1) * this.limite, this.paginaActual() * this.limite,
  ));
  private readonly solicitados = new Set<number>();

  constructor() {
    inject(DestroyRef).onDestroy(() => { this.destruido = true; this.solicitud++; });
    effect(() => {
      this.auth.usuario();
      this.auth.autenticado();
      this.auth.tieneRol('ESTUDIANTE');
      this.reintento();
      untracked(() => void this.cargar());
    });
    effect(() => {
      // Los filtros se aplican a todos los cursos: /mi-aprendizaje no tiene paginación HTTP.
      this.categoria(); this.progreso(); this.docente(); this.busqueda(); this.orden();
      untracked(() => this.pagina.set(1));
    });
    effect(() => {
      const visibles = this.cursosVisibles();
      untracked(() => void this.cargarUltimasLecciones(visibles, this.solicitud));
    });
  }

  private vigente(version: number, usuarioId: number): boolean {
    return !this.destruido && version === this.solicitud
      && this.auth.autenticado() && this.auth.usuario()?.idUsuario === usuarioId
      && this.auth.tieneRol('ESTUDIANTE');
  }

  private explicar(error: unknown, accion: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.auth.sesionExpirada();
        return 'Tu sesión caducó. Inicia sesión para continuar.';
      }
      if (error.status === 403) return 'Tu cuenta no tiene permiso para consultar estos cursos.';
      if (error.status === 404) return 'El curso ya no está disponible para tu cuenta.';
      if (error.status === 0) return 'No pudimos conectar. Comprueba tu conexión y vuelve a intentarlo.';
    }
    return accion + ' no se pudo completar. Inténtalo de nuevo.';
  }

  private async cargar(): Promise<void> {
    const actual = ++this.solicitud;
    const usuarioId = this.auth.usuario()?.idUsuario;
    this.cursos.set([]);
    this.detalles.set(new Map());
    this.solicitados.clear();
    this.navegando.set(null);
    this.errorNavegacion.set('');
    this.pagina.set(1);
    this.error.set('');
    this.cargando.set(true);
    if (!usuarioId || !this.auth.autenticado() || !this.auth.tieneRol('ESTUDIANTE')) {
      this.error.set('Inicia sesión con una cuenta de estudiante para ver tus cursos.');
      this.cargando.set(false);
      return;
    }
    try {
      const respuesta = await this.api.listar();
      if (this.vigente(actual, usuarioId)) this.cursos.set(respuesta.items);
    } catch (error) {
      if (this.vigente(actual, usuarioId)) this.error.set(this.explicar(error, 'Cargar tus cursos'));
    } finally {
      if (actual === this.solicitud) this.cargando.set(false);
    }
  }

  private async cargarUltimasLecciones(cursos: CursoInscrito[], version: number): Promise<void> {
    const usuarioId = this.auth.usuario()?.idUsuario;
    if (!usuarioId) return;
    const pendientes = cursos.filter((c) => c.inscripcion.ultimaLeccionId !== null && !this.solicitados.has(c.curso.id));
    for (const curso of pendientes) this.solicitados.add(curso.curso.id);
    // Máximo tres consultas simultáneas, solo para las tarjetas visibles.
    let siguiente = 0;
    const cargar = async () => {
      while (siguiente < pendientes.length && this.vigente(version, usuarioId)) {
        const curso = pendientes[siguiente++]!;
        let detalle: DetalleAprendizaje | null = null;
        try {
          const recibido = await this.api.detalle(curso.curso.id);
          if (recibido.curso.id === curso.curso.id) detalle = recibido;
        } catch (error) {
          if (this.vigente(version, usuarioId) && error instanceof HttpErrorResponse && error.status === 401) {
            this.auth.sesionExpirada();
          }
        }
        if (this.vigente(version, usuarioId)) {
          this.detalles.update((actual) => new Map(actual).set(curso.curso.id, detalle));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, pendientes.length) }, cargar));
  }

  protected ultimaLeccion(curso: CursoInscrito): string {
    if (curso.inscripcion.ultimaLeccionId === null) return 'Aún no has comenzado';
    const detalle = this.detalles().get(curso.curso.id);
    if (detalle === undefined) return 'Cargando última lección…';
    if (detalle === null) return 'No pudimos consultar la última lección';
    return detalle.modulos.flatMap((m) => m.lecciones)
      .find((leccion) => leccion.id === detalle.inscripcion.ultimaLeccionId)?.titulo
      ?? 'Última lección no disponible';
  }

  protected async abrir(curso: CursoInscrito): Promise<void> {
    const usuarioId = this.auth.usuario()?.idUsuario;
    if (this.navegando() !== null || !usuarioId || !this.auth.autenticado()) return;
    const actual = this.solicitud;
    this.navegando.set(curso.curso.id);
    this.errorNavegacion.set('');
    try {
      const detalle = await this.api.detalle(curso.curso.id);
      if (!this.vigente(actual, usuarioId)) return;
      if (detalle.curso.id !== curso.curso.id) throw new Error('Curso incorrecto');
      const leccion = leccionParaContinuar(detalle);
      if (!leccion) {
        this.errorNavegacion.set('Este curso todavía no tiene lecciones disponibles.');
        return;
      }
      await this.router.navigate(['/aprender', curso.curso.id, leccion.id]);
    } catch (error) {
      if (this.vigente(actual, usuarioId)) this.errorNavegacion.set(this.explicar(error, 'Abrir el curso'));
    } finally {
      if (actual === this.solicitud) this.navegando.set(null);
    }
  }

  protected cambiarPagina(pagina: number): void {
    if (Number.isInteger(pagina) && pagina >= 1 && pagina <= this.totalPaginas()) this.pagina.set(pagina);
  }
  protected reintentar(): void { this.reintento.update((n) => n + 1); }
  protected valor(evento: Event): string { return (evento.target as HTMLInputElement | HTMLSelectElement).value; }
  protected quitarFiltros(): void {
    this.categoria.set(''); this.progreso.set(''); this.docente.set(''); this.busqueda.set('');
  }
  protected tono(id: number): 1 | 2 | 3 { return id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2; }
}
