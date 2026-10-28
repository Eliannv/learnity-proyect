import { Component, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { RecursoAprendizaje } from '../../../core/api/contrato';
import { mensajeDeError } from '../../../core/http/error-api';
import { ToastService } from '../../../shared/ui/toast.service';
import { guardarBlob, tamanoLegible } from '../../../shared/util/descargar';
import { ContenidoApi } from '../../contenido/contenido.api';

const ICONO: Record<RecursoAprendizaje['tipo'], string> = { PDF: 'file-text', PPT: 'presentation', ZIP: 'code' };

/** Material descargable de la lección que se está viendo. */
@Component({
  selector: 'app-recursos-estudiante',
  imports: [LucideAngularModule],
  template: `
    <section class="recursos" aria-labelledby="titulo-recursos">
      <h2 id="titulo-recursos">Recursos de esta lección</h2>
      <ul>
        @for (r of recursos(); track r.id) {
          <li>
            <span class="icono" aria-hidden="true"><lucide-icon [name]="icono[r.tipo]" [size]="20" /></span>
            <span class="nombre"><strong>{{ r.titulo }}</strong><small>{{ r.tipo }} · {{ tamano(r.tamanoBytes) }}</small></span>
            <button type="button" class="btn btn-contorno btn-sm" [disabled]="descargando() === r.id" (click)="descargar(r)"
              [attr.aria-label]="'Descargar ' + r.titulo">
              <lucide-icon name="download" [size]="16" aria-hidden="true" />
              {{ descargando() === r.id ? 'Descargando…' : 'Descargar' }}
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .recursos { display: grid; gap: 10px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--tinta-900); }
    ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    li {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio);
    }
    .icono {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radio);
      background: var(--azul-050);
      color: var(--azul-700);
    }
    .nombre { display: grid; min-width: 0; strong { overflow-wrap: anywhere; } small { color: var(--tinta-700); font-size: 13px; } }
    .btn { display: inline-flex; align-items: center; gap: 6px; }
  `,
})
export class RecursosEstudiante {
  private readonly api = inject(ContenidoApi);
  private readonly toast = inject(ToastService);

  readonly recursos = input.required<RecursoAprendizaje[]>();
  protected readonly icono = ICONO;
  protected readonly descargando = signal<number | null>(null);

  protected tamano(bytes: number): string {
    return tamanoLegible(bytes);
  }

  protected async descargar(r: RecursoAprendizaje): Promise<void> {
    this.descargando.set(r.id);
    try {
      guardarBlob(await this.api.descargarPdf(r.archivoId), r.nombreOriginal);
    } catch (error) {
      this.toast.error(mensajeDeError(error, 'Descargar el recurso'));
    } finally {
      this.descargando.set(null);
    }
  }
}
