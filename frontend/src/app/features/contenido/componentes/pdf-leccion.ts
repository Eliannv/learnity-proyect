import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter, lastValueFrom, map, tap } from 'rxjs';
import type {
  CursoDetalle,
  LeccionPrivada,
} from '../../../core/cursos/gestion-cursos.model';
import { Peticion } from '../../../core/estado/peticion';

@Component({
  selector: 'app-pdf-leccion',
  templateUrl: './pdf-leccion.html',
  styleUrl: './pdf-leccion.scss',
})
export class PdfLeccion {
  readonly leccion = input.required<LeccionPrivada>();
  readonly editable = input(false);
  readonly bloqueado = input(false);
  /** true en un VIDEO: el PDF es su material de apoyo, no el contenido de la lección. */
  readonly complementario = input(false);
  readonly subirArchivo =
    input.required<
      (leccionId: number, archivo: File) => Observable<HttpEvent<CursoDetalle>>
    >();
  readonly descargarArchivo =
    input.required<(archivoId: number) => Promise<Blob>>();

  readonly actualizado = output<CursoDetalle>();
  readonly ocupado = output<boolean>();
  readonly recargar = output<void>();

  protected readonly p = new Peticion();
  protected readonly progreso = signal<number | null>(null);
  protected readonly subiendo = signal(false);

  private readonly destruir = inject(DestroyRef);

  protected async subir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];

    entrada.value = '';

    if (
      !archivo ||
      !this.editable() ||
      this.bloqueado() ||
      this.p.ocupada() ||
      this.p.requiereRecarga()
    ) {
      return;
    }

    this.p.limpiar();

    if (
      !/\.pdf$/i.test(archivo.name) ||
      archivo.size < 1 ||
      archivo.size > 10 * 1024 * 1024
    ) {
      this.p.error.set('Selecciona un PDF de entre 1 byte y 10 MB.');
      return;
    }

    this.progreso.set(null);
    this.subiendo.set(true);
    this.ocupado.emit(true);

    await this.p.ejecutar(
      () =>
        lastValueFrom(
          this.subirArchivo()(this.leccion().id, archivo).pipe(
            takeUntilDestroyed(this.destruir),
            tap((eventoHttp) => {
              if (eventoHttp.type === HttpEventType.UploadProgress) {
                this.progreso.set(
                  eventoHttp.total
                    ? Math.min(
                        100,
                        Math.round((eventoHttp.loaded * 100) / eventoHttp.total),
                      )
                    : null,
                );
              }
            }),
            filter(
              (eventoHttp): eventoHttp is HttpResponse<CursoDetalle> =>
                eventoHttp instanceof HttpResponse,
            ),
            map((respuesta) => {
              if (!respuesta.body) {
                throw new Error('Respuesta vacía al subir el PDF.');
              }
              return respuesta.body;
            }),
          ),
        ),
      (curso) => this.actualizado.emit(curso),
      'PDF guardado y asociado a la lección.',
    );

    this.subiendo.set(false);
    this.ocupado.emit(false);
  }

  protected async descargar(): Promise<void> {
    const archivo = this.leccion().archivo;

    if (
      !archivo ||
      this.bloqueado() ||
      this.p.ocupada() ||
      this.p.requiereRecarga()
    ) {
      return;
    }

    this.ocupado.emit(true);

    await this.p.ejecutar(
      () => this.descargarArchivo()(archivo.id),
      (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = archivo.nombreOriginal;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
    );

    this.ocupado.emit(false);
  }
}
