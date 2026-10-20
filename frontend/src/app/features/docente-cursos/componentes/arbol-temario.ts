import { HttpEvent } from '@angular/common/http';
import {
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  type CursoDetalle,
  type DatosLeccion,
  type DatosModulo,
  type LeccionPrivada,
  type ModuloPrivado,
  siguienteOrden,
} from '../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../core/estado/peticion';
import { PdfLeccion } from '../../contenido/componentes/pdf-leccion';

@Component({
  selector: 'app-arbol-temario',
  imports: [FormsModule, PdfLeccion],
  templateUrl: './arbol-temario.html',
  styleUrl: './arbol-temario.scss',
})
export class ArbolTemario {
  readonly curso = input.required<CursoDetalle>();
  readonly editable = input(false);
  readonly bloqueado = input(false);
  readonly guardarModuloFn =
    input<
      (
        cursoId: number,
        id: number | null,
        datos: DatosModulo,
      ) => Promise<CursoDetalle>
    >();
  readonly guardarLeccionFn =
    input<
      (
        moduloId: number,
        id: number | null,
        datos: DatosLeccion,
      ) => Promise<CursoDetalle>
    >();
  readonly eliminarContenidoFn =
    input<
      (tipo: 'modulos' | 'lecciones', id: number) => Promise<CursoDetalle>
    >();
  readonly subirArchivoFn =
    input.required<
      (leccionId: number, archivo: File) => Observable<HttpEvent<CursoDetalle>>
    >();
  readonly descargarArchivoFn =
    input.required<(archivoId: number) => Promise<Blob>>();

  readonly actualizado = output<CursoDetalle>();
  readonly ocupado = output<boolean>();
  readonly formularioAbierto = output<boolean>();
  readonly recargar = output<void>();

  protected readonly p = new Peticion();
  private readonly trabajo = signal(false);

  protected readonly deshabilitado = computed(
    () =>
      this.bloqueado() ||
      this.trabajo() ||
      this.p.requiereRecarga(),
  );

  protected modulo: {
    id: number | null;
    titulo: string;
    orden: number;
  } | null = null;

  protected leccion: {
    id: number | null;
    moduloId: number;
    titulo: string;
    orden: number;
  } | null = null;

  protected hayFormulario(): boolean {
    return this.modulo !== null || this.leccion !== null;
  }

  protected abrirModulo(m?: ModuloPrivado): void {
    this.p.limpiar();
    this.modulo = {
      id: m?.id ?? null,
      titulo: m?.titulo ?? '',
      orden: m?.orden ?? siguienteOrden(this.curso().modulos, 10),
    };
    this.formularioAbierto.emit(true);
  }

  protected abrirLeccion(m: ModuloPrivado, l?: LeccionPrivada): void {
    this.p.limpiar();
    this.leccion = {
      id: l?.id ?? null,
      moduloId: m.id,
      titulo: l?.titulo ?? '',
      orden: l?.orden ?? siguienteOrden(m.lecciones, 12),
    };
    this.formularioAbierto.emit(true);
  }

  protected cerrarFormulario(): void {
    this.modulo = null;
    this.leccion = null;
    this.formularioAbierto.emit(false);
  }

  protected cambiarOcupado(valor: boolean): void {
    this.trabajo.set(valor);
    this.ocupado.emit(valor);
  }

  protected async guardarModulo(): Promise<void> {
    const m = this.modulo;
    const fn = this.guardarModuloFn();
    if (!m || !fn) return;

    if (!m.titulo.trim()) {
      this.p.campos.set({ titulo: 'Escribe el título del módulo.' });
      return;
    }

    if (!Number.isInteger(m.orden) || m.orden < 1 || m.orden > 10) {
      this.p.campos.set({ orden: 'Usa un número entero entre 1 y 10.' });
      return;
    }

    await this.mutar(() =>
      fn(this.curso().id, m.id, {
        titulo: m.titulo.trim(),
        orden: m.orden,
      }),
    );
  }

  protected async guardarLeccion(): Promise<void> {
    const l = this.leccion;
    const fn = this.guardarLeccionFn();
    if (!l || !fn) return;

    if (!l.titulo.trim()) {
      this.p.campos.set({ titulo: 'Escribe el título de la lección.' });
      return;
    }

    if (!Number.isInteger(l.orden) || l.orden < 1 || l.orden > 12) {
      this.p.campos.set({ orden: 'Usa un número entero entre 1 y 12.' });
      return;
    }

    await this.mutar(() =>
      fn(l.moduloId, l.id, {
        titulo: l.titulo.trim(),
        orden: l.orden,
        tipo: 'DOCUMENTO',
      }),
    );
  }

  protected async eliminar(
    tipo: 'modulos' | 'lecciones',
    id: number,
  ): Promise<void> {
    const fn = this.eliminarContenidoFn();
    if (!fn) return;

    const confirmado = confirm(
      '¿Eliminar este contenido? También se eliminarán sus lecciones o archivos asociados.',
    );
    if (!confirmado) return;

    await this.mutar(() => fn(tipo, id));
  }

  private async mutar(tarea: () => Promise<CursoDetalle>): Promise<void> {
    if (!this.editable() || this.deshabilitado()) return;

    this.cambiarOcupado(true);
    await this.p.ejecutar(
      tarea,
      (curso) => {
        this.cerrarFormulario();
        this.actualizado.emit(curso);
      },
      'Contenido guardado.',
    );
    this.cambiarOcupado(false);
  }
}
