import { Component, computed, input, signal } from '@angular/core';
import type { DetalleCambioAuditoria } from '../../../../../core/api/contrato';
import { filasDiff } from './filas-diff';

/**
 * Tabla «Datos antes y después» de un registro de auditoría. El valor anterior va en rojo con «−» y el nuevo en
 * verde con «+»; además del color, cada celda lo dice con texto (para lectores de pantalla y para no depender
 * solo del color). En un UPDATE se ven por defecto solo las columnas que cambiaron.
 */
@Component({
  selector: 'app-diff-cambio',
  template: `
    @if (detalle().operacion === 'UPDATE') {
      <label class="casilla">
        <input type="checkbox" [checked]="soloCambios()" (change)="soloCambios.set($any($event.target).checked)" />
        Mostrar solo las columnas que cambiaron ({{ cambiadas() }} de {{ filas().length }})
      </label>
    }
    <div class="contenedor" tabindex="0" role="region" aria-label="Datos antes y después">
      <table class="tabla diff">
        <caption class="visualmente-oculto">Datos antes y después del cambio</caption>
        <thead>
          <tr>
            <th scope="col">Columna</th>
            <th scope="col">Antes</th>
            <th scope="col">Después</th>
          </tr>
        </thead>
        <tbody>
          @for (f of visibles(); track f.columna) {
            <tr [class.cambio]="f.cambio">
              <th scope="row">
                <code>{{ f.columna }}</code>
                @if (f.cambio && detalle().operacion === 'UPDATE') { <span class="marca">Cambió</span> }
              </th>
              @if (f.sinValor) {
                <td colspan="2" class="sin-valor">Cambió, pero su valor no se registra por seguridad.</td>
              } @else {
                <td [class.antes]="f.cambio && f.antes !== null">
                  @if (f.antes === null) {
                    <span class="vacio">—<span class="visualmente-oculto">sin valor anterior</span></span>
                  } @else if (f.cambio) {
                    <span class="signo" aria-hidden="true">−</span><span class="visualmente-oculto">Valor anterior: </span>
                    <span class="valor">{{ f.antes }}</span>
                  } @else {
                    <span class="valor">{{ f.antes }}</span>
                  }
                </td>
                <td [class.despues]="f.cambio && f.despues !== null">
                  @if (f.despues === null) {
                    <span class="vacio">—<span class="visualmente-oculto">sin valor nuevo</span></span>
                  } @else if (f.cambio) {
                    <span class="signo" aria-hidden="true">+</span><span class="visualmente-oculto">Valor nuevo: </span>
                    <span class="valor">{{ f.despues }}</span>
                  } @else {
                    <span class="valor">{{ f.despues }}</span>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .casilla { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
    .contenedor { overflow-x: auto; border: 1px solid var(--gris-200); border-radius: var(--radio); }
    .diff { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--gris-100); }
    thead th { background: var(--gris-100); font-size: 12px; text-transform: uppercase; letter-spacing: .02em; }
    tbody th { font-weight: 500; white-space: nowrap; }
    .valor { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--fuente-mono, ui-monospace, monospace); }
    .antes { background: var(--rojo-050); color: var(--rojo-700); }
    .despues { background: var(--verde-100); color: var(--verde-700); }
    .signo { margin-right: 6px; font-weight: 700; }
    .marca {
      display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
      background: var(--ambar-100); color: var(--ambar-800); font-size: 11px; font-weight: 600;
    }
    .vacio { color: var(--gris-500); }
    .sin-valor { font-style: italic; color: var(--tinta-700); }
  `,
})
export class DiffCambio {
  readonly detalle = input.required<DetalleCambioAuditoria>();

  protected readonly soloCambios = signal(true);
  protected readonly filas = computed(() => filasDiff(this.detalle()));
  protected readonly cambiadas = computed(() => this.filas().filter((f) => f.cambio).length);
  protected readonly visibles = computed(() =>
    this.detalle().operacion === 'UPDATE' && this.soloCambios() ? this.filas().filter((f) => f.cambio) : this.filas());
}
