import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CursoDetalle, ProblemaCampo } from '../../../core/api/contrato';

@Component({
  selector: 'app-panel-publicacion',
  imports: [RouterLink],
  templateUrl: './panel-publicacion.html',
  styleUrl: './panel-publicacion.scss',
})
export class PanelPublicacion {
  readonly curso = input.required<CursoDetalle>();
  readonly deshabilitado = input(false);
  readonly enviar = output<void>();
  readonly irAPaso = output<1 | 2>();

  /** Publicado: se edita sin volver a revisión, así que no hay nada que enviar. */
  protected readonly publicado = computed(() => this.curso().estado === 'PUBLICADO');
  protected readonly problemas = computed(() => this.curso().validacion.problemas);
  private readonly lecciones = computed(() => this.curso().modulos.flatMap((m) => m.lecciones));
  protected readonly totalVideos = computed(() => this.lecciones().filter((l) => l.tipo === 'VIDEO').length);
  /** PDF subidos: el de cada documento y el material de apoyo de los vídeos. */
  protected readonly totalPdf = computed(() => this.lecciones().filter((l) => l.archivo !== null).length);

  protected pasoDe(problema: ProblemaCampo): 1 | 2 {
    return problema.campo.startsWith('modulos') ? 2 : 1;
  }
}
