import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ErrorCargaService } from '../../core/navegacion/error-carga';

/**
 * Aviso persistente cuando una sección no se pudo descargar. No recarga solo (evita bucles si el
 * servidor sigue caído): explica qué pasó y ofrece recargar la sección que se pidió.
 */
@Component({
  selector: 'app-error-carga',
  imports: [LucideAngularModule],
  template: `
    @if (servicio.destino(); as destino) {
      <div class="aviso" role="alert">
        <lucide-icon name="circle-alert" [size]="20" aria-hidden="true" />
        <div class="texto">
          <strong>No se pudo cargar esta sección</strong>
          <span>El servidor se reinició, se publicó una versión nueva o se perdió la conexión. Recarga para continuar.</span>
        </div>
        <div class="acciones">
          <button type="button" class="btn btn-primario btn-sm" (click)="recargar(destino)">Recargar la página</button>
          <button type="button" class="cerrar" aria-label="Cerrar aviso" (click)="servicio.cerrar()">
            <lucide-icon name="x" [size]="18" aria-hidden="true" />
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .aviso {
      position: fixed; z-index: 1000; top: 16px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px;
      width: min(720px, calc(100% - 32px));
      padding: 14px 16px;
      border: 1px solid var(--rojo-200);
      border-radius: var(--radio-md);
      background: var(--blanco);
      box-shadow: 0 12px 32px rgb(15 23 42 / 16%);
      color: var(--tinta-900);
      > lucide-icon { flex: none; color: var(--rojo-700); }
    }
    .texto { display: grid; gap: 2px; flex: 1; font-size: 14px; span { color: var(--tinta-700); } }
    .acciones { display: flex; align-items: center; gap: 4px; }
    .cerrar {
      display: grid; place-items: center; width: 44px; height: 44px;
      border: 0; border-radius: var(--radio); background: none; color: var(--gris-500); cursor: pointer;
      &:hover { background: var(--gris-100); }
    }
    @media (max-width: 560px) { .aviso { flex-wrap: wrap; } .acciones { width: 100%; justify-content: flex-end; } }
  `,
})
export class ErrorCarga {
  protected readonly servicio = inject(ErrorCargaService);
  private readonly documento = inject(DOCUMENT);

  /** Recarga completa hacia la sección pedida: así el navegador descarga la versión vigente de la app. */
  protected recargar(destino: string): void {
    this.documento.location.assign(destino);
  }
}
