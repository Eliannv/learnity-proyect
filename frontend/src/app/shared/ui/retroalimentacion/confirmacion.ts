import { Component, inject } from '@angular/core';
import { ConfirmacionService } from './confirmacion.service';
import { Modal } from './modal';

/** Modal de `ConfirmacionService`. Escape, la X o el fondo cancelan; el foco empieza en «Cancelar». */
@Component({
  selector: 'app-confirmacion',
  imports: [Modal],
  template: `
    @if (servicio.actual(); as p) {
      <app-modal [titulo]="p.titulo" [icono]="p.icono ?? (p.peligro ? 'circle-alert' : 'info')" [ancho]="460"
        (cerrar)="servicio.responder(false)">
        <p class="mensaje">{{ p.mensaje }}</p>
        <div class="pie">
          <button type="button" class="btn btn-contorno" (click)="servicio.responder(false)">Cancelar</button>
          <button type="button" class="btn" [class.btn-peligro]="p.peligro" [class.btn-primario]="!p.peligro"
            (click)="servicio.responder(true)">{{ p.accion }}</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .mensaje { margin: 0 0 20px; line-height: 1.55; color: var(--tinta-800); white-space: pre-line; }
    .pie { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
    @media (max-width: 600px) { .pie .btn { flex: 1 1 auto; } }
  `,
})
export class Confirmacion {
  protected readonly servicio = inject(ConfirmacionService);
}
