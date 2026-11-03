import { Esqueleto } from '../../../../shared/ui/retroalimentacion/esqueleto';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/http/error-api';
import { AprendizajeApi, type CursoInscrito } from '../../aprendizaje.api';
import { AnilloProgreso } from '../../../../shared/ui/datos/anillo-progreso';
import { BarraProgreso } from '../../../../shared/ui/datos/barra-progreso';
import { BuscadorCurso, type OpcionCursoBusqueda } from '../../../../shared/ui/cursos/buscador-curso';
import { PortadaCurso } from '../../../../shared/ui/cursos/portada-curso';

type FiltroProgreso = '' | 'en-curso' | 'sin-empezar' | 'completados';
type Orden = 'reciente' | 'avance' | 'titulo';

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Cursos realmente inscritos: la API conserva el avance entre sesiones. */
@Component({
  selector: 'app-mi-aprendizaje',
  imports: [Esqueleto, RouterLink, LucideAngularModule, AnilloProgreso, BarraProgreso, BuscadorCurso, PortadaCurso],
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
  protected readonly busquedaCategoria = signal('');
  protected readonly progreso = signal<FiltroProgreso>('');
  protected readonly docente = signal('');
  protected readonly busquedaDocente = signal('');
  protected readonly cursoId = signal<number | null>(null);
  protected readonly busqueda = signal('');
  protected readonly orden = signal<Orden>('reciente');

  protected readonly categorias = computed(() => [...new Set(this.cursos().map((i) => i.curso.categoria.nombre))].sort((a, b) => a.localeCompare(b, 'es')));
  protected readonly docentes = computed(() => [...new Set(this.cursos().map((i) => i.curso.docente))].sort((a, b) => a.localeCompare(b, 'es')));
  protected readonly opcionesCategorias = computed<OpcionCursoBusqueda[]>(() => {
    const porNombre = new Map<string, string | null | undefined>();
    for (const i of this.cursos()) {
      if (!porNombre.has(i.curso.categoria.nombre)) {
        porNombre.set(i.curso.categoria.nombre, i.curso.categoria.icono);
      }
    }
    return [...porNombre.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([titulo, iconoCategoria], id) => ({ id, titulo, iconoCategoria }));
  });
  protected readonly idCategoria = computed(() =>
    this.opcionesCategorias().find((c) => c.titulo === this.categoria())?.id ?? null,
  );
  protected readonly opcionesDocentes = computed<OpcionCursoBusqueda[]>(() =>
    this.docentes().map((titulo, id) => ({ id, titulo })),
  );
  protected readonly idDocente = computed(() =>
    this.opcionesDocentes().find((d) => d.titulo === this.docente())?.id ?? null,
  );
  protected readonly opcionesCursos = computed<OpcionCursoBusqueda[]>(() =>
    this.cursos()
      .filter((i) => this.coincideContexto(i))
      .map((i) => ({
        id: i.curso.id,
        titulo: i.curso.titulo,
        subtitulo: i.curso.docente,
        portadaUrl: i.curso.portadaUrl,
        iconoCategoria: i.curso.categoria.icono,
      })),
  );
  protected readonly totalLecciones = computed(() => this.cursos().reduce((s, c) => s + c.totalLecciones, 0));
  protected readonly completadas = computed(() => this.cursos().reduce((s, c) => s + c.leccionesCompletadas, 0));
  /** Siguiente curso para retomar: ni completado ni suspendido (D2: un curso suspendido no se puede abrir). */
  protected readonly principal = computed(() =>
    this.cursos().find((c) => c.inscripcion.estado !== 'COMPLETADA' && !c.suspendido) ?? null);
  /** Quedan cursos sin terminar, pero todos están suspendidos: no se puede decir que los completó. */
  protected readonly pendientesSuspendidos = computed(() =>
    this.cursos().some((c) => c.inscripcion.estado !== 'COMPLETADA' && c.suspendido));
  protected readonly hayFiltros = computed(() => !!(
    this.categoria() ||
    this.busquedaCategoria().trim() ||
    this.progreso() ||
    this.docente() ||
    this.busquedaDocente().trim() ||
    this.cursoId() !== null ||
    this.busqueda().trim()
  ));
  protected readonly lista = computed(() => {
    const idSel = this.cursoId();
    const q = normalizar(this.busqueda());
    const cursos = this.cursos().filter((i) =>
      this.coincideContexto(i) &&
      (idSel !== null ? i.curso.id === idSel : !q || normalizar(i.curso.titulo).includes(q)),
    );
    if (this.orden() === 'avance') return [...cursos].sort((a, b) => b.inscripcion.progresoPct - a.inscripcion.progresoPct);
    if (this.orden() === 'titulo') return [...cursos].sort((a, b) => a.curso.titulo.localeCompare(b.curso.titulo, 'es'));
    return [...cursos].sort((a, b) => Date.parse(b.inscripcion.inscritoEn) - Date.parse(a.inscripcion.inscritoEn));
  });

  private coincideContexto(i: CursoInscrito): boolean {
    const catSel = this.categoria();
    const catQ = normalizar(this.busquedaCategoria());
    const docSel = this.docente();
    const docQ = normalizar(this.busquedaDocente());
    const coincideCat = catSel
      ? i.curso.categoria.nombre === catSel
      : !catQ || normalizar(i.curso.categoria.nombre).includes(catQ);
    const coincideDoc = docSel
      ? i.curso.docente === docSel
      : !docQ || normalizar(i.curso.docente).includes(docQ);
    const coincideProg =
      this.progreso() === '' ||
      (this.progreso() === 'en-curso' && i.inscripcion.progresoPct > 0 && i.inscripcion.estado !== 'COMPLETADA') ||
      (this.progreso() === 'sin-empezar' && i.inscripcion.progresoPct === 0) ||
      (this.progreso() === 'completados' && i.inscripcion.estado === 'COMPLETADA');
    return coincideCat && coincideDoc && coincideProg;
  }

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

  protected elegirCategoria(id: number | null): void {
    this.categoria.set(id === null ? '' : (this.opcionesCategorias().find((c) => c.id === id)?.titulo ?? ''));
    if (id !== null) this.busquedaCategoria.set('');
  }
  protected cambiarBusquedaCategoria(texto: string): void {
    this.busquedaCategoria.set(texto);
    if (texto.trim()) this.categoria.set('');
  }
  protected elegirDocente(id: number | null): void {
    this.docente.set(id === null ? '' : (this.opcionesDocentes().find((d) => d.id === id)?.titulo ?? ''));
    if (id !== null) this.busquedaDocente.set('');
  }
  protected cambiarBusquedaDocente(texto: string): void {
    this.busquedaDocente.set(texto);
    if (texto.trim()) this.docente.set('');
  }
  protected elegirCurso(id: number | null): void {
    this.cursoId.set(id);
    if (id !== null) this.busqueda.set('');
  }
  protected cambiarBusqueda(texto: string): void {
    this.busqueda.set(texto);
    if (texto.trim()) this.cursoId.set(null);
  }
  protected reintentar(): void { this.reintento.update((n) => n + 1); }
  protected valor(evento: Event): string { return (evento.target as HTMLInputElement | HTMLSelectElement).value; }
  protected quitarFiltros(): void {
    this.categoria.set('');
    this.busquedaCategoria.set('');
    this.progreso.set('');
    this.docente.set('');
    this.busquedaDocente.set('');
    this.cursoId.set(null);
    this.busqueda.set('');
  }
  protected tono(id: number): 1 | 2 | 3 { return id % 3 === 0 ? 3 : id % 3 === 1 ? 1 : 2; }
}
