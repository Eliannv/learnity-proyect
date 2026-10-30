import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import * as echarts from 'echarts';
import type { SerieGrafico } from './grafico-series';

export type TipoGraficoEcharts = 'barras' | 'lineas' | 'area' | 'apiladas';

/** La tipografía de la app en ejes, leyenda y tooltips (el lienzo no admite font-variant-numeric). */
const FUENTE_GRAFICO = "'DM Sans', system-ui, sans-serif";

@Component({
  selector: 'app-grafico-echarts',
  imports: [LucideAngularModule],
  template: `
    <figure class="grafico-echarts-contenedor">
      <figcaption class="visualmente-oculto">{{ titulo() }}</figcaption>

      <div class="cabecera-grafico">
        @if (permitirCambioTipo()) {
          <div class="selector-tipo" role="group" aria-label="Cambiar visualización del gráfico">
            <button
              type="button"
              class="btn-tipo"
              [class.activo]="tipo() === 'barras'"
              (click)="seleccionarTipo('barras')"
              title="Ver como barras agrupadas"
            >
              <lucide-icon name="chart-column" [size]="16" aria-hidden="true" />
              <span>Barras</span>
            </button>
            <button
              type="button"
              class="btn-tipo"
              [class.activo]="tipo() === 'lineas'"
              (click)="seleccionarTipo('lineas')"
              title="Ver como líneas"
            >
              <lucide-icon name="chart-line" [size]="16" aria-hidden="true" />
              <span>Líneas</span>
            </button>
            <button
              type="button"
              class="btn-tipo"
              [class.activo]="tipo() === 'area'"
              (click)="seleccionarTipo('area')"
              title="Ver como área sombreada"
            >
              <lucide-icon name="chart-spline" [size]="16" aria-hidden="true" />
              <span>Área</span>
            </button>
            <button
              type="button"
              class="btn-tipo"
              [class.activo]="tipo() === 'apiladas'"
              (click)="seleccionarTipo('apiladas')"
              title="Ver como barras apiladas"
            >
              <lucide-icon name="chart-column-stacked" [size]="16" aria-hidden="true" />
              <span>Apiladas</span>
            </button>
          </div>
        }
      </div>

      <div #canvasContenedor class="lienzo-echarts" role="img" [attr.aria-label]="titulo()"></div>

      <details class="tabla-datos">
        <summary>Ver datos en tabla</summary>
        <div class="tabla-contenedor" role="region" [attr.aria-label]="titulo()" tabindex="0">
          <table class="tabla">
            <thead>
              <tr>
                <th scope="col">Mes</th>
                @for (s of series(); track s.nombre) {
                  <th scope="col">{{ s.nombre }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (c of categorias(); track $index; let i = $index) {
                <tr>
                  <th scope="row">{{ etiquetaLarga(i) }}</th>
                  @for (s of series(); track s.nombre) {
                    <td>{{ s.valores[i] ?? '—' }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  `,
  styles: `
    .grafico-echarts-contenedor {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }

    .cabecera-grafico {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 100%;
      margin-bottom: 4px;
    }

    .selector-tipo {
      display: inline-flex;
      background: var(--elevado);
      padding: 3px;
      border-radius: var(--radio-md, 8px);
      border: 1px solid var(--borde);
      gap: 2px;
    }

    .btn-tipo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--tinta-2);
      background: transparent;
      border: 0;
      border-radius: 6px;
      cursor: pointer;
      transition:
        background-color var(--t-micro) var(--curva-salida),
        color var(--t-micro) var(--curva-salida),
        box-shadow var(--t-micro) var(--curva-salida);

      &:hover {
        color: var(--tinta);
      }

      &.activo {
        background: var(--superficie);
        color: var(--acento-tinta);
        font-weight: 600;
        box-shadow: inset 0 0 0 1px var(--borde);
      }
    }

    .lienzo-echarts {
      width: 100%;
      height: 320px;
      min-height: 280px;
    }

    .tabla-datos {
      margin-top: 10px;
      font-size: 13px;

      summary {
        cursor: pointer;
        color: var(--acento);
        font-weight: 600;
        padding: 4px 0;
        user-select: none;

        &:hover {
          text-decoration: underline;
        }
      }

      .tabla-contenedor {
        margin-top: 10px;
        border: 1px solid var(--borde);
        border-radius: var(--radio-md, 8px);
        overflow-x: auto;
        background: var(--superficie);
        -webkit-overflow-scrolling: touch;
      }

      .tabla {
        width: 100%;
        min-width: 540px;
        border-collapse: collapse;
        font-size: 14px;

        th {
          padding: 12px 16px;
          border-bottom: 1px solid var(--borde);
          color: var(--tinta-3);
          font-size: 12px;
          font-weight: 500;
          text-align: left;
          white-space: nowrap;
        }

        th[scope="row"] {
          color: var(--tinta);
          font-weight: 600;
          font-size: 13px;
          white-space: nowrap;
        }

        td {
          padding: 12px 16px;
          border-top: 1px solid var(--borde);
          text-align: left;
          color: var(--tinta);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
      }
    }

    .visualmente-oculto {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 640px) {
      .cabecera-grafico {
        justify-content: stretch;
        width: 100%;
      }

      .selector-tipo {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        width: 100%;
        padding: 4px;
        gap: 4px;
        border-radius: 10px;
      }

      .btn-tipo {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 4px;
        min-height: 48px;
        width: 100%;
        border-radius: 6px;

        span {
          display: block;
          font-size: 11px;
          line-height: 1.1;
          font-weight: 500;
        }

        lucide-icon {
          flex-shrink: 0;
        }

        &.activo {
          background: var(--superficie);
          color: var(--acento-tinta);
          font-weight: 700;
          box-shadow: inset 0 0 0 1px var(--borde);
        }
      }

      .lienzo-echarts {
        height: 280px;
      }
    }
  `,
})
export class GraficoEcharts {
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasContenedor = viewChild<ElementRef<HTMLDivElement>>('canvasContenedor');

  readonly titulo = input<string>('');
  readonly categorias = input<readonly string[]>([]);
  readonly categoriasLargas = input<readonly string[] | undefined>(undefined);
  readonly series = input<readonly SerieGrafico[]>([]);
  readonly tipo = model<TipoGraficoEcharts>('barras');
  readonly permitirCambioTipo = input<boolean>(true);
  readonly minimo = input<number | undefined>(undefined);
  readonly maximo = input<number | undefined>(undefined);
  readonly decimales = input<number>(0);

  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.inicializarGrafico();
    });

    effect(() => {
      // Reacciona ante cambios de datos o de tipo de gráfico
      this.series();
      this.categorias();
      this.tipo();
      this.actualizarGrafico();
    });

    this.destroyRef.onDestroy(() => {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (this.chart) {
        this.chart.dispose();
        this.chart = null;
      }
    });
  }

  protected seleccionarTipo(tipo: TipoGraficoEcharts): void {
    this.tipo.set(tipo);
  }

  protected etiquetaLarga(i: number): string {
    return this.categoriasLargas()?.[i] ?? this.categorias()[i] ?? '';
  }

  private inicializarGrafico(): void {
    const el = this.canvasContenedor()?.nativeElement;
    if (!el || this.chart) return;

    this.chart = echarts.init(el, null, { renderer: 'canvas' });
    this.actualizarGrafico();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.chart?.resize();
      });
      this.resizeObserver.observe(el);
    }
  }

  private actualizarGrafico(): void {
    if (!this.chart) return;

    const categorias = [...this.categorias()];
    const categoriasLargas = this.categoriasLargas();
    const series = this.series();
    const tipo = this.tipo();
    const minimo = this.minimo();
    const maximo = this.maximo();

    if (!categorias.length || !series.length) {
      this.chart.clear();
      return;
    }

    // Serie principal en el acento; la de comparación en gris de control (3,3:1 sobre blanco). Colores planos, sin
    // degradados ni sombras: el dato es lo que tiene color (DIAGNOSTICO_REDISENO_UI.md, §2).
    const colorPrimario = '#1d4ed8'; // --acento
    const colorSecundario = '#868e9b'; // --borde-control
    const colores = [colorPrimario, colorSecundario];

    const opcionesSeries: echarts.SeriesOption[] = series.map((s, index) => {
      const color = colores[index % colores.length]!;

      if (tipo === 'barras') {
        return {
          name: s.nombre,
          type: 'bar',
          data: [...s.valores],
          barMaxWidth: 26,
          itemStyle: {
            color,
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            focus: 'series',
          },
        };
      } else if (tipo === 'apiladas') {
        return {
          name: s.nombre,
          type: 'bar',
          stack: 'total',
          data: [...s.valores],
          barMaxWidth: 30,
          itemStyle: {
            color,
            borderRadius: index === series.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0],
          },
          emphasis: {
            focus: 'series',
          },
        };
      } else if (tipo === 'area') {
        return {
          name: s.nombre,
          type: 'line',
          smooth: 0.35,
          showSymbol: true,
          symbolSize: 7,
          data: [...s.valores],
          lineStyle: {
            color,
            width: 2.5,
          },
          itemStyle: {
            color,
            borderWidth: 2,
            borderColor: '#ffffff',
          },
          areaStyle: {
            color: index === 0 ? 'rgba(29, 78, 216, 0.10)' : 'rgba(134, 142, 155, 0.10)',
          },
          emphasis: {
            focus: 'series',
          },
        };
      } else {
        // lineas
        return {
          name: s.nombre,
          type: 'line',
          smooth: 0.35,
          showSymbol: true,
          symbolSize: 8,
          data: [...s.valores],
          lineStyle: {
            color,
            width: 3,
          },
          itemStyle: {
            color,
            borderWidth: 2,
            borderColor: '#ffffff',
          },
          emphasis: {
            focus: 'series',
            scale: 1.3,
          },
        };
      }
    });

    const option: echarts.EChartsOption = {
      animationDuration: 400,
      animationEasing: 'cubicOut',
      grid: {
        top: 36,
        right: 16,
        bottom: 28,
        left: 28,
        containLabel: true,
      },
      legend: {
        top: 0,
        left: 'left',
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: '#4b5563',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: FUENTE_GRAFICO,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: tipo === 'barras' || tipo === 'apiladas' ? 'shadow' : 'line',
          shadowStyle: { color: 'rgba(229, 231, 235, 0.45)' },
          lineStyle: { color: '#868e9b', type: 'dashed' },
        },
        backgroundColor: '#111827',
        borderColor: '#111827',
        borderRadius: 8,
        padding: [10, 14],
        textStyle: {
          color: '#f8fafc',
          fontSize: 13,
          fontFamily: FUENTE_GRAFICO,
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params.length) return '';
          const dataIndex = params[0].dataIndex;
          const tituloMes = categoriasLargas?.[dataIndex] ?? categorias[dataIndex] ?? '';
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#f8fafc">${tituloMes}</div>`;
          for (const item of params) {
            const val = item.value !== null && item.value !== undefined ? item.value : '—';
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:3px;">
              <span style="display:inline-flex;align-items:center;gap:6px;color:#cbd5e1;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};"></span>
                ${item.seriesName}
              </span>
              <strong style="color:#ffffff;">${val}</strong>
            </div>`;
          }
          return html;
        },
      },
      xAxis: {
        type: 'category',
        data: categorias,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#5f6672',
          fontSize: 12,
          fontFamily: FUENTE_GRAFICO,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        min: minimo,
        max: maximo,
        minInterval: 1,
        splitLine: {
          lineStyle: {
            color: '#f2f2f2',
            type: 'solid',
          },
        },
        axisLabel: {
          color: '#5f6672',
          fontSize: 12,
          fontFamily: FUENTE_GRAFICO,
        },
      },
      series: opcionesSeries,
    };

    this.chart.setOption(option, true);
  }
}
