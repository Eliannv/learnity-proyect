import { Component, input, output } from '@angular/core';
import type { CursoDetalle } from '../../../core/api/contrato';

@Component({
  selector: 'app-panel-publicacion',
  templateUrl: './panel-publicacion.html',
  styleUrl: './panel-publicacion.scss',
})
export class PanelPublicacion {
  readonly curso = input.required<CursoDetalle>();
  readonly deshabilitado = input(false);

  readonly enviar = output<void>();
}
