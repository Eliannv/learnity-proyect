import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { mensajeDeError } from '../../../../core/http/error-api';
import { SesionesApi, type EstadoBaseDatos } from '../sesiones.api';
import { formatearBytes, tiempoEnLinea } from '../paginas/sesiones/formato';

/**
 * Telemetría de la base de datos en una sola fila: etiqueta pequeña arriba y valor tabular abajo, separados por
 * líneas verticales. Va arriba de «Accesos y sesiones» (las dos pestañas).
 */
@Component({
  selector: 'app-estado-bd',
  imports: [DatePipe],
  template: `
    <section class="estado-bd" aria-labelledby="titulo-estado-bd">
      <h2 id="titulo-estado-bd" class="visualmente-oculto">Estado de la base de datos</h2>
      @if (error()) {
        <p class="error" role="alert">
          {{ error() }} <button type="button" class="btn btn-texto btn-sm" (click)="cargar()">Reintentar</button>
        </p>
      } @else if (estado(); as e) {
        <dl class="indicadores">
          <div class="salud">
            <dt>Base de datos</dt>
            <dd><span class="punto" aria-hidden="true"></span> En línea</dd>
          </div>
          <div><dt>PostgreSQL</dt><dd class="valor">{{ e.version }}</dd></div>
          <div><dt>Tamaño</dt><dd class="valor">{{ bytes(e.tamanoBytes) }}</dd></div>
          <div><dt>Conexiones abiertas</dt><dd class="valor">{{ e.conexiones }}</dd></div>
          <div [title]="'Desde el ' + (e.iniciadaEn | date: 'd MMM y, HH:mm')">
            <dt>Tiempo en línea</dt><dd class="valor">{{ enLinea(e.iniciadaEn) }}</dd>
          </div>
          <div class="migracion" [title]="e.ultimaMigracion?.aplicadaEn ? 'Aplicada el ' + (e.ultimaMigracion!.aplicadaEn! | date: 'd MMM y, HH:mm') : 'Esquema inicial'">
            <dt>Última migración</dt><dd class="valor">{{ e.ultimaMigracion?.version ?? '—' }}</dd>
          </div>
        </dl>
      } @else {
        <div class="indicadores esqueleto" role="status" aria-busy="true" aria-label="Cargando el estado de la base de datos"></div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .indicadores {
      display: flex;
      flex-wrap: wrap;
      margin: 0;
      border: 1px solid var(--borde);
      border-radius: var(--radio);
      background: var(--superficie);
      > div {
        flex: 1 1 140px;
        min-width: 0;
        padding: 12px 16px;
        border-left: 1px solid var(--borde);
        &:first-child { border-left: 0; }
      }
      dt { font-size: 12px; color: var(--tinta-3); }
      dd {
        margin: 2px 0 0;
        overflow: hidden;
        font-size: 15px;
        font-weight: 600;
        color: var(--tinta);
        font-variant-numeric: tabular-nums;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .valor { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 14px; }
      .migracion { flex-basis: 200px; }
    }
    .indicadores.esqueleto { height: 62px; }
    .salud dd { display: flex; align-items: center; gap: 6px; color: var(--positivo); }
    .punto { width: 8px; height: 8px; border-radius: 50%; background: var(--positivo); }
    .error { margin: 0; color: var(--negativo); }
    @media (max-width: 700px) {
      .indicadores > div { flex-basis: 45%; border-left: 0; border-top: 1px solid var(--regla); }
    }
  `,
})
export class EstadoBd {
  private readonly api = inject(SesionesApi);
  protected readonly bytes = formatearBytes;
  protected readonly enLinea = tiempoEnLinea;
  protected readonly estado = signal<EstadoBaseDatos | null>(null);
  protected readonly error = signal('');

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.error.set('');
    try {
      this.estado.set(await this.api.estadoBaseDatos());
    } catch (error) {
      this.error.set(mensajeDeError(error, 'Consultar el estado de la base de datos'));
    }
  }
}
