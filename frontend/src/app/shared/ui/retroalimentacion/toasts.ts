import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService, type TipoToast } from './toast.service';

const ICONO: Record<TipoToast, string> = { exito: 'circle-check', error: 'circle-alert', info: 'info' };

/**
 * Pila de avisos de `ToastService`, abajo a la derecha (arriba en móvil).
 * Los éxitos se anuncian con cortesía (`status`) y los errores de inmediato (`alert`).
 */
@Component({
  selector: 'app-toasts',
  imports: [LucideAngularModule],
  template: `
    <div class="pila">
      @for (t of servicio.avisos(); track t.id) {
        <div [class]="'toast ' + t.tipo" [attr.role]="t.tipo === 'error' ? 'alert' : 'status'">
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
      right: 20px;
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
      border-radius: var(--radio-md);
      border-left: 4px solid var(--azul-600);
      background: var(--tinta-900);
      color: var(--blanco);
      box-shadow: var(--sombra-lg);
      pointer-events: auto;
      animation: entrar 0.2s ease-out;
      p { margin: 2px 0 0; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
    }
    .exito { border-left-color: #22c55e; lucide-icon { color: #4ade80; } }
    .error { border-left-color: #ef4444; lucide-icon { color: #f87171; } }
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
      lucide-icon { color: inherit; }
      &:hover { background: rgb(255 255 255 / 12%); color: var(--blanco); }
      &:focus-visible { outline: 2px solid var(--blanco); outline-offset: 1px; }
    }
    @keyframes entrar { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
    @media (max-width: 600px) { .pila { top: 12px; bottom: auto; right: 16px; } }
  `,
})
export class Toasts {
  protected readonly servicio = inject(ToastService);
  protected readonly icono = ICONO;
}
