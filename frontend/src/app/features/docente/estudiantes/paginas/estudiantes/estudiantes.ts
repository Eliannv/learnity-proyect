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
import { BuscadorCurso } from '../../../../../shared/ui/cursos/buscador-curso';
import { Indicador } from '../../../../../shared/ui/datos/indicador';
import { Estrellas } from '../../../../../shared/ui/datos/estrellas';

/** Seguimiento paginado: permite filtrar por un curso específico o ver todos los estudiantes. */
@Component({
  selector: 'app-estudiantes-curso',
  imports: [Esqueleto, DatePipe, DecimalPipe, RouterLink, Avatar, BarraProgreso, BuscadorCurso, Indicador, Estrellas],
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss',
})
export class EstudiantesCurso {
  private readonly cursosApi = inject(DocenteCursosApi);
  private readonly seguimientoApi = inject(SeguimientoDocenteApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private version = 0;

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
      const solicitado = this.ruta.snapshot.queryParamMap.get('curso');
      const id = solicitado ? Number(solicitado) : null;
      this.cursoId.set(id !== null && respuesta.items.some((c) => c.id === id) ? id : null);
      await this.cargarEstudiantes(this.cursoId(), 1, version);
    } catch (error) {
      if (version === this.version) this.cargaCursos.fallar(error);
    } finally {
      if (version === this.version) this.cargaCursos.ocupada.set(false);
    }
  }

  protected cambiarCursoId(id: number | null): void {
    if (id !== null && !this.cursos().some((curso) => curso.id === id)) return;
    this.cursoId.set(id);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { curso: id ?? undefined },
      replaceUrl: true,
    });
    void this.cargarEstudiantes(id, 1);
  }

  protected cambiarCurso(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const id = valor === '' ? null : Number(valor);
    this.cambiarCursoId(id);
  }

  protected cargarPagina(pagina: number): void {
    const totalPaginas = this.seguimiento()?.totalPaginas ?? 0;
    if (pagina >= 1 && pagina <= totalPaginas) {
      void this.cargarEstudiantes(this.cursoId(), pagina);
    }
  }

  protected reintentarEstudiantes(): void {
    void this.cargarEstudiantes(this.cursoId(), this.pagina());
  }

  protected iniciales(nombre: string): string {
    return nombre.split(/\s+/).slice(0, 2).map((parte) => parte[0] ?? '').join('').toUpperCase();
  }

  protected pct(parte: number, total: number): number {
    return total ? Math.round((parte / total) * 100) : 0;
  }

  private async cargarEstudiantes(id: number | null, pagina: number, version = ++this.version): Promise<void> {
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
