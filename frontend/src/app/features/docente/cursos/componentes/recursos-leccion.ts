import { Component, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { CursoDetalle, LeccionPrivada } from '../../../../core/cursos/gestion-cursos.model';
import { mensajeDeError } from '../../../../core/http/error-api';
import { Modal } from '../../../../shared/ui/retroalimentacion/modal';
import { ToastService } from '../../../../shared/ui/retroalimentacion/toast.service';
import { guardarBlob, tamanoLegible } from '../../../../shared/util/descargar';
import { ContenidoApi } from '../../../contenido/contenido.api';

type Recurso = LeccionPrivada['recursos'][number];

const MAXIMO = 5;
const EXTENSIONES = /\.(pdf|pptx?|zip)$/i;
const ICONO: Record<Recurso['tipo'], string> = { PDF: 'file-text', PPT: 'presentation', ZIP: 'code' };

/** Material descargable de una lección (PDF, PPT o ZIP): listar, añadir, descargar y quitar. */
@Component({
  selector: 'app-recursos-leccion',
  imports: [LucideAngularModule, Modal],
  template: `
    <div class="recursos">
      <div class="cabecera">
        <h4>Recursos descargables <span class="texto-suave">{{ leccion().recursos.length }}/{{ maximo }}</span></h4>
        @if (editable() && leccion().recursos.length < maximo) {
          <input #entrada type="file" class="visualmente-oculto" accept=".pdf,.ppt,.pptx,.zip"
            [disabled]="bloqueado() || subiendo()" (change)="subir($event)"
            [attr.aria-label]="'Añadir un recurso a ' + leccion().titulo" tabindex="-1" />
          <button type="button" class="btn btn-contorno btn-sm" [disabled]="bloqueado() || subiendo()" (click)="entrada.click()">
            <lucide-icon [name]="subiendo() ? 'loader-circle' : 'upload'" [size]="16" aria-hidden="true" [class.girar]="subiendo()" />
            {{ subiendo() ? 'Subiendo…' : 'Añadir recurso' }}
          </button>
        }
      </div>
      @if (leccion().recursos.length) {
        <ul>
          @for (r of leccion().recursos; track r.id) {
            <li>
              <lucide-icon [name]="icono[r.tipo]" [size]="18" aria-hidden="true" />
              <span class="nombre">
                <strong>{{ r.titulo }}</strong>
                <small class="texto-suave">{{ r.nombreOriginal }} · {{ tamano(r.tamanoBytes) }}</small>
              </span>
              <button type="button" class="btn btn-texto btn-sm" (click)="descargar(r)"
                [attr.aria-label]="'Descargar ' + r.titulo">Descargar</button>
              @if (editable()) {
                <button type="button" class="btn btn-texto btn-sm peligro" [disabled]="bloqueado()" (click)="quitando.set(r)"
                  [attr.aria-label]="'Quitar ' + r.titulo">Quitar</button>
              }
            </li>
          }
        </ul>
      } @else if (editable()) {
        <p class="texto-suave vacio">Añade código en ZIP, diapositivas o plantillas para que tus estudiantes las descarguen.</p>
      }
    </div>

    @if (quitando(); as r) {
      <app-modal [titulo]="'¿Quitar «' + r.titulo + '»?'" icono="trash-2" [ancho]="440" (cerrar)="quitando.set(null)">
        <p class="texto-modal">Tus estudiantes dejarán de poder descargarlo y el archivo se borrará del servidor.</p>
        <div class="pie">
          <button type="button" class="btn btn-contorno" (click)="quitando.set(null)">Cancelar</button>
          <button type="button" class="btn btn-peligro" (click)="quitar(r)">Quitar recurso</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .recursos { display: grid; gap: 8px; }
    .cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      h4 { margin: 0; font-size: 0.95rem; }
      .btn { display: inline-flex; align-items: center; gap: 6px; }
    }
    ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    li {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--borde);
      border-radius: var(--radio);
      background: var(--superficie);
    }
    .nombre { display: grid; min-width: 0; strong, small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
    .peligro { color: var(--negativo); }
    .vacio { margin: 0; font-size: 0.88rem; }
    .texto-modal { margin: 0 0 20px; line-height: 1.55; }
    .pie { display: flex; justify-content: flex-end; gap: 10px; }
    .girar { animation: girar 1s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .girar { animation: none; } }
  `,
})
export class RecursosLeccion {
  private readonly api = inject(ContenidoApi);
  private readonly toast = inject(ToastService);

  readonly leccion = input.required<LeccionPrivada>();
  readonly editable = input(false);
  readonly bloqueado = input(false);
  readonly actualizado = output<CursoDetalle>();
  readonly ocupado = output<boolean>();

  protected readonly maximo = MAXIMO;
  protected readonly icono = ICONO;
  protected readonly subiendo = signal(false);
  protected readonly quitando = signal<Recurso | null>(null);

  protected tamano(bytes: number): string {
    return tamanoLegible(bytes);
  }

  protected async subir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo || this.subiendo()) return;
    if (!EXTENSIONES.test(archivo.name)) {
      this.toast.error('Solo se admiten archivos PDF, PPT, PPTX o ZIP.');
      return;
    }
    if (archivo.size < 1 || archivo.size > 10 * 1024 * 1024) {
      this.toast.error('El archivo debe pesar como máximo 10 MB.');
      return;
    }
    this.subiendo.set(true);
    this.ocupado.emit(true);
    try {
      this.actualizado.emit(await this.api.subirRecurso(this.leccion().id, archivo));
      this.toast.exito(`«${archivo.name}» añadido a la lección.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Subir el recurso'));
    } finally {
      this.subiendo.set(false);
      this.ocupado.emit(false);
    }
  }

  protected async quitar(r: Recurso): Promise<void> {
    this.quitando.set(null);
    this.ocupado.emit(true);
    try {
      this.actualizado.emit(await this.api.eliminarRecurso(r.id));
      this.toast.exito(`«${r.titulo}» quitado.`);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Quitar el recurso'));
    } finally {
      this.ocupado.emit(false);
    }
  }

  protected async descargar(r: Recurso): Promise<void> {
    try {
      guardarBlob(await this.api.descargarPdf(r.archivoId), r.nombreOriginal);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Descargar el recurso'));
    }
  }
}
