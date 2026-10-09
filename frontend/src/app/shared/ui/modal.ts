import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** Ventana modal con fondo oscuro. Se cierra con la X, con Escape o al hacer clic fuera. */
@Component({
  selector: 'app-modal',
  imports: [LucideAngularModule],
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fondo" (click)="cerrar.emit()"></div>
    <section class="panel" role="dialog" aria-modal="true" [attr.aria-label]="titulo()" [style.max-width.px]="ancho()">
      <header>
        @if (icono()) {
          <span class="icono"><lucide-icon [name]="icono()!" [size]="22" /></span>
        }
        <h2>{{ titulo() }}</h2>
        <button type="button" class="cerrar" (click)="cerrar.emit()" aria-label="Cerrar">
          <lucide-icon name="x" [size]="22" />
        </button>
      </header>
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .fondo {
      position: absolute;
      inset: 0;
      background: rgb(15 23 42 / 45%);
    }
    .panel {
      position: relative;
      width: 100%;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      padding: 28px;
      border-radius: var(--radio-lg);
      background: var(--blanco);
      box-shadow: var(--sombra-lg);
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    h2 {
      flex: 1;
      font-size: 22px;
      font-weight: 700;
    }
    .icono {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radio);
      background: var(--azul-700);
      color: var(--blanco);
    }
    .cerrar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: var(--radio);
      background: transparent;
      color: var(--gris-500);
      &:hover {
        background: var(--gris-100);
      }
    }
    @media (max-width: 600px) {
      :host {
        align-items: end;
        padding: 0;
      }
      .panel {
        border-radius: var(--radio-lg) var(--radio-lg) 0 0;
        padding: 22px 20px;
      }
    }
  `,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly icono = input<string>();
  readonly ancho = input(540);
  readonly cerrar = output<void>();
}
