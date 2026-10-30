import { type AnimationCallbackEvent, Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService, type TipoToast } from './toast.service';

const ICONO: Record<TipoToast, string> = { exito: 'circle-check', error: 'circle-alert', info: 'info' };
/** La salida dura --t-hoja; el tope cubre el caso sin `animationend` (movimiento reducido). */
const SALIDA_MS = 380;

/**
 * Pila de avisos de `ToastService`, abajo a la izquierda como en Udemy (en el móvil, encima de la barra inferior).
 * Los avisos suben desde el borde y bajan por el mismo camino, sin fundido al entrar (axe mide su contraste en
 * cuanto aparecen); al salir son `inert` y axe los omite.
 * Los éxitos se anuncian con cortesía (`status`) y los errores de inmediato (`alert`).
 */
@Component({
  selector: 'app-toasts',
  imports: [LucideAngularModule],
  template: `
    <div class="pila">
      @for (t of servicio.avisos(); track t.id) {
        <div [class]="'toast ' + t.tipo" [attr.role]="t.tipo === 'error' ? 'alert' : 'status'" (animate.leave)="salir($event)">
          <lucide-icon [name]="icono[t.tipo]" [size]="20" aria-hidden="true" />
          <p>{{ t.mensaje }}</p>
          <button type="button" class="cerrar" (click)="servicio.cerrar(t.id)" aria-label="Cerrar aviso">
            <lucide-icon name="x" [size]="16" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .pila {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 200;
      display: grid;
      gap: 10px;
      width: min(380px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr) 28px;
      align-items: start;
      gap: 10px;
      padding: 12px 12px 12px 14px;
      border-radius: var(--radio);
      background: var(--tinta);
      color: #fff;
      box-shadow: var(--sombra-flotante);
      pointer-events: auto;
      animation: subir var(--t-hoja) var(--curva-hoja);
      p { margin: 2px 0 0; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
      &.saliendo {
        pointer-events: none;
        animation: bajar var(--t-hoja) var(--curva-hoja) forwards;
      }
    }
    /* El color va en el ícono (no en una franja lateral): verde, rojo o azul claros, 7:1 o más sobre la tinta. */
    .exito lucide-icon { color: #4ade80; }
    .error lucide-icon { color: #f87171; }
    .info lucide-icon { color: #93c5fd; }
    .cerrar {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: var(--radio-sm);
      background: transparent;
      color: #cbd5e1;
      transition: background-color var(--t-micro) var(--curva-salida), transform var(--t-pulsar) var(--curva-salida);
      lucide-icon { color: inherit; }
      &:hover { background: rgb(255 255 255 / 12%); color: #fff; }
      &:active { transform: scale(0.92); }
      &:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
    }
    /* Sube desde el borde inferior y baja por el mismo camino. */
    @keyframes subir { from { transform: translateY(calc(100% + 24px)); } }
    @keyframes bajar { to { transform: translateY(calc(100% + 24px)); opacity: 0; } }
    @media (max-width: 900px) {
      .pila {
        left: 16px;
        bottom: calc(var(--alto-tabbar) + 12px + env(safe-area-inset-bottom));
      }
    }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class Toasts {
  protected readonly servicio = inject(ToastService);
  protected readonly icono = ICONO;

  /** Angular retiene el aviso hasta `animationComplete`: baja inerte (sin foco ni clics) y luego se quita. */
  protected salir(evento: AnimationCallbackEvent): void {
    const aviso = evento.target as HTMLElement;
    aviso.inert = true;
    aviso.classList.add('saliendo');
    let hecho = false;
    const terminar = () => {
      if (hecho) return;
      hecho = true;
      evento.animationComplete();
    };
    aviso.addEventListener('animationend', terminar, { once: true });
    setTimeout(terminar, SALIDA_MS);
  }
}
