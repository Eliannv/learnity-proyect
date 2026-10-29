import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type EstadoVista = 'cargando' | 'vacio' | 'error';

const ICONOS: Record<EstadoVista, string> = {
  cargando: 'loader-circle',
  vacio: 'inbox',
  error: 'circle-alert',
};

const TITULOS: Record<EstadoVista, string> = {
  cargando: 'Cargando…',
  vacio: 'No hay nada para mostrar',
  error: 'No se pudo completar la operación',
};

/**
 * Estado común de una vista: carga, vacío o error.
 * El error se anuncia (`role="alert"`) y puede ofrecer reintentar; la carga y el vacío son `role="status"`.
 * Contenido proyectado: acción opcional (por ejemplo, un botón «Crear curso»).
 */
@Component({
  selector: 'app-estado-vista',
  imports: [LucideAngularModule],
  template: `
    <div
      class="estado"
      [class.error]="estado() === 'error'"
      [attr.role]="estado() === 'error' ? 'alert' : 'status'"
      [attr.aria-busy]="estado() === 'cargando' ? 'true' : null"
    >
      <span class="icono" [class.girar]="estado() === 'cargando'" aria-hidden="true">
        <lucide-icon [name]="icono()" [size]="28" />
      </span>
      <p class="titulo">{{ tituloVisible() }}</p>
      @if (mensaje()) {
        <p class="mensaje">{{ mensaje() }}</p>
      }
      @if (estado() === 'error' && reintentable()) {
        <button type="button" class="btn btn-contorno btn-sm" (click)="reintentar.emit()">Reintentar</button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 20px;
      text-align: center;
      border: 1px dashed var(--gris-200);
      border-radius: var(--radio-md);
      background: var(--blanco);
    }
    .estado.error {
      border-style: solid;
      border-color: var(--rojo-200);
      background: var(--rojo-050);
    }
    .icono {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--azul-050);
      color: var(--azul-700);
    }
    .error .icono {
      background: var(--blanco);
      color: var(--rojo-700);
    }
    .girar lucide-icon {
      animation: girar 1s linear infinite;
    }
    .titulo {
      font-weight: 600;
      color: var(--tinta-900);
    }
    .error .titulo {
      color: var(--rojo-700);
    }
    .mensaje {
      max-width: 46ch;
      font-size: 14px;
      color: var(--gris-500);
    }
    .error .mensaje {
      color: var(--tinta-800);
    }
    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .girar lucide-icon {
        animation: none;
      }
    }
  `,
})
export class EstadoVistaComponent {
  readonly estado = input.required<EstadoVista>();
  /** Si se omite, se usa un título por defecto según el estado. */
  readonly titulo = input<string>();
  readonly mensaje = input<string>();
  /** En el estado de error, muestra el botón «Reintentar». */
  readonly reintentable = input(true);
  readonly reintentar = output<void>();

  protected readonly icono = computed(() => ICONOS[this.estado()]);
  protected readonly tituloVisible = computed(() => this.titulo() || TITULOS[this.estado()]);
}
