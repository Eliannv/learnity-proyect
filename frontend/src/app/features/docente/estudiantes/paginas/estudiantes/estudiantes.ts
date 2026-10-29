import { Esqueleto } from '../../../../../shared/ui/retroalimentacion/esqueleto';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CursoResumen, SeguimientoDocente } from '../../../../../core/api/contrato';
import { Peticion } from '../../../../../core/estado/peticion';
import { DocenteCursosApi } from '../../../cursos/cursos.api';
import { SeguimientoDocenteApi } from '../../estudiantes.api';
import { Avatar } from '../../../../../shared/ui/marca/avatar';
import { BarraProgreso } from '../../../../../shared/ui/datos/barra-progreso';
import { Indicador } from '../../../../../shared/ui/datos/indicador';
import { Estrellas } from '../../../../../shared/ui/datos/estrellas';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { guardarBlob } from '../../../../../shared/util/descargar';
import { mensajeDeError } from '../../../../../core/http/error-api';

/** Seguimiento paginado: el servidor comprueba que el curso pertenezca al docente. */
@Component({
  selector: 'app-estudiantes-curso',
  imports: [Esqueleto, DatePipe, DecimalPipe, RouterLink, Avatar, BarraProgreso, Indicador, Estrellas],
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss',
})
export class EstudiantesCurso {
  private readonly cursosApi = inject(DocenteCursosApi);
  private readonly seguimientoApi = inject(SeguimientoDocenteApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private version = 0;

  protected readonly exportando = signal(false);

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
    void this.cargarCursos();
  }

  protected async cargarCursos(): Promise<void> {
    const version = ++this.version;
    this.cargaCursos.limpiar();
    this.cargaCursos.ocupada.set(true);
    this.cursos.set([]);
    this.seguimiento.set(null);

    try {
      const respuesta = await this.cursosApi.misCursos();
      if (version !== this.version) return;
      this.cursos.set(respuesta.items);
      const solicitado = Number(this.ruta.snapshot.queryParamMap.get('curso'));
      const id = respuesta.items.find((c) => c.id === solicitado)?.id ?? respuesta.items[0]?.id ?? null;
      this.cursoId.set(id);
      if (id !== null) await this.cargarEstudiantes(id, 1, version);
    } catch (error) {
      if (version === this.version) this.cargaCursos.fallar(error);
    } finally {
      if (version === this.version) this.cargaCursos.ocupada.set(false);
    }
  }

  protected cambiarCurso(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    if (!this.cursos().some((curso) => curso.id === id)) return;
    this.cursoId.set(id);
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: { curso: id }, replaceUrl: true });
    void this.cargarEstudiantes(id, 1);
  }

  protected cargarPagina(pagina: number): void {
    const id = this.cursoId();
    if (id !== null && pagina >= 1 && pagina <= (this.seguimiento()?.totalPaginas ?? 0)) {
      void this.cargarEstudiantes(id, pagina);
    }
  }

  protected reintentarEstudiantes(): void {
    const id = this.cursoId();
    if (id !== null) void this.cargarEstudiantes(id, this.pagina());
  }

  /** Descarga el CSV (se abre en Excel) con todos los inscritos, no solo los de esta página. */
  protected async exportar(): Promise<void> {
    const id = this.cursoId();
    if (id === null || this.exportando()) return;
    this.exportando.set(true);
    try {
      const { blob, nombre } = await this.seguimientoApi.exportar(id);
      guardarBlob(blob, nombre);
      this.toasts.exito(`Descargaste «${nombre}».`);
    } catch (error) {
      this.toasts.error(mensajeDeError(error, 'Exportar los estudiantes'));
    } finally {
      this.exportando.set(false);
    }
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
      if (version === this.version) this.seguimiento.set(datos);
    } catch (error) {
      if (version === this.version) this.cargaEstudiantes.fallar(error);
    } finally {
      if (version === this.version) this.cargaEstudiantes.ocupada.set(false);
    }
  }
}
