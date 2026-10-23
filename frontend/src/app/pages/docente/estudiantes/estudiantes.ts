import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CursoResumen, SeguimientoDocente } from '../../../core/api/contrato';
import { Peticion } from '../../../core/estado/peticion';
import { DocenteCursosApi } from '../../../features/docente-cursos/docente-cursos.api';
import { SeguimientoDocenteApi } from '../../../features/docente-cursos/seguimiento-docente.api';
import { Avatar } from '../../../shared/ui/avatar';
import { Indicador } from '../../../shared/ui/indicador';
import { AuthService } from '../../../core/auth/auth.service';
import { idApi } from '../../../features/aprendizaje/aprendizaje.api';

/** Seguimiento paginado: el servidor comprueba que el curso pertenezca al docente. */
@Component({
  selector: 'app-estudiantes-curso',
  imports: [DatePipe, RouterLink, Avatar, Indicador],
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss',
})
export class EstudiantesCurso {
  private readonly cursosApi = inject(DocenteCursosApi);
  private readonly seguimientoApi = inject(SeguimientoDocenteApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private version = 0;
  private versionCursos = 0;

  protected readonly cargaCursos = new Peticion();
  protected readonly cargaEstudiantes = new Peticion();
  protected readonly cursos = signal<CursoResumen[]>([]);
  protected readonly cursoId = signal<number | null>(null);
  protected readonly pagina = signal(1);
  protected readonly seguimiento = signal<SeguimientoDocente | null>(null);
  protected readonly cursoSeleccionado = computed(
    () => this.cursos().find((c) => c.id === this.cursoId()),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => { this.version++; this.versionCursos++; });
    this.ruta.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (!this.cursos().length || this.cargaCursos.ocupada()) return;
      const id = params.has('curso') ? idApi(params.get('curso')!) : this.cursos()[0]!.id;
      const pagina = params.has('pagina') ? idApi(params.get('pagina')!) : 1;
      if (id === null || !this.cursos().some((curso) => curso.id === id) || pagina === null || pagina > 10000) {
        this.version++;
        this.seguimiento.set(null);
        this.cursoId.set(null);
        this.cargaEstudiantes.limpiar();
        this.cargaEstudiantes.error.set('El curso o la página solicitada no está disponible. Selecciona uno de tus cursos.');
      } else if (id !== this.cursoId() || pagina !== this.pagina()) {
        this.cursoId.set(id);
        void this.cargarEstudiantes(id, pagina);
      }
    });
    void this.cargarCursos();
  }

  protected async cargarCursos(): Promise<void> {
    const version = ++this.versionCursos;
    this.version++;
    this.cargaCursos.limpiar();
    this.cargaCursos.ocupada.set(true);
    this.cursos.set([]);
    this.cursoId.set(null);
    this.seguimiento.set(null);

    try {
      const respuesta = await this.cursosApi.misCursos();
      if (version !== this.versionCursos) return;
      this.cursos.set(respuesta.items);
      const params = this.ruta.snapshot.queryParamMap;
      const solicitado = params.has('curso') ? idApi(params.get('curso')!) : null;
      const pagina = params.has('pagina') ? idApi(params.get('pagina')!) : 1;
      if ((params.has('curso') && !respuesta.items.some((curso) => curso.id === solicitado)) || pagina === null || pagina > 10000) {
        this.cargaEstudiantes.error.set('El curso o la página solicitada no está disponible. Selecciona uno de tus cursos.');
        return;
      }
      const id = solicitado ?? respuesta.items[0]?.id ?? null;
      this.cursoId.set(id);
      this.cargaCursos.ocupada.set(false);
      if (id !== null) await this.cargarEstudiantes(id, pagina);
    } catch (error) {
      if (version === this.versionCursos) this.fallar(this.cargaCursos, error);
    } finally {
      if (version === this.versionCursos) this.cargaCursos.ocupada.set(false);
    }
  }

  protected cambiarCurso(evento: Event): void {
    const id = idApi((evento.target as HTMLSelectElement).value);
    if (id === null) return;
    if (!this.cursos().some((curso) => curso.id === id)) return;
    this.cursoId.set(id);
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: { curso: id, pagina: 1 }, replaceUrl: true });
    void this.cargarEstudiantes(id, 1);
  }

  protected cargarPagina(pagina: number): void {
    const id = this.cursoId();
    if (id !== null && !this.cargaEstudiantes.ocupada() && Number.isInteger(pagina)
      && pagina >= 1 && pagina <= Math.min(10000, this.seguimiento()?.totalPaginas ?? 0)) {
      void this.router.navigate([], { relativeTo: this.ruta, queryParams: { curso: id, pagina }, replaceUrl: true });
      void this.cargarEstudiantes(id, pagina);
    }
  }

  protected reintentarEstudiantes(): void {
    const id = this.cursoId();
    if (id !== null && !this.cargaEstudiantes.ocupada()) void this.cargarEstudiantes(id, this.pagina());
  }

  protected iniciales(nombre: string): string {
    return nombre.split(/\s+/).slice(0, 2).map((parte) => parte[0] ?? '').join('').toUpperCase();
  }

  private async cargarEstudiantes(id: number, pagina: number, version = ++this.version): Promise<void> {
    this.pagina.set(pagina);
    this.cargaEstudiantes.limpiar();
    this.cargaEstudiantes.ocupada.set(true);
    this.seguimiento.set(null);
    try {
      const datos = await this.seguimientoApi.listar(id, pagina);
      if (version !== this.version) return;
      if (datos.curso.id !== id) throw new Error('Respuesta de otro curso');
      this.seguimiento.set(datos);
    } catch (error) {
      if (version === this.version) this.fallar(this.cargaEstudiantes, error);
    } finally {
      if (version === this.version) this.cargaEstudiantes.ocupada.set(false);
    }
  }

  private fallar(peticion: Peticion, error: unknown): void {
    peticion.fallar(error);
    if (error instanceof HttpErrorResponse && error.status === 401) {
      peticion.error.set('Tu sesión caducó. Inicia sesión para continuar.');
      this.auth.sesionExpirada();
    }
  }
}
