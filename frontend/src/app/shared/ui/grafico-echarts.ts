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
      flex-wrap: wrap;
      gap: 8px;
    }

    .selector-tipo {
      display: inline-flex;
      background: var(--gris-100, #f1f5f9);
      padding: 3px;
      border-radius: var(--radio-md, 8px);
      border: 1px solid var(--gris-200, #e2e8f0);
    }

    .btn-tipo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--tinta-700, #475569);
      background: transparent;
      border: 0;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        color: var(--tinta-900, #0f172a);
      }

      &.activo {
        background: var(--blanco, #ffffff);
        color: var(--azul-700, #1d4ed8);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .lienzo-echarts {
      width: 100%;
      height: 320px;
      min-height: 280px;
    }

    .tabla-datos {
      margin-top: 8px;
      font-size: 13px;

      summary {
        cursor: pointer;
        color: var(--azul-700, #1d4ed8);
        font-weight: 500;
        &:hover {
          text-decoration: underline;
        }
      }

      .tabla {
        width: 100%;
        margin-top: 8px;
        border-collapse: collapse;

        th,
        td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--gris-200, #e2e8f0);
          text-align: left;
        }

        th {
          font-weight: 600;
          color: var(--tinta-800, #1e293b);
        }

        td {
          color: var(--tinta-600, #475569);
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
        justify-content: center;
      }
      .btn-tipo span {
        display: none;
      }
      .btn-tipo {
        padding: 6px 8px;
      }
      .lienzo-echarts {
        height: 260px;
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

    // Colores corporativos validados (Azul Learnity y Ámbar Learnity)
    const colorPrimario = '#1d4ed8'; // var(--azul-700)
    const colorSecundario = '#d97706'; // var(--ambar-600)
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
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: index === 0 ? '#3b82f6' : '#f59e0b' },
              { offset: 1, color },
            ]),
            borderRadius: [5, 5, 0, 0],
          },
          emphasis: {
            focus: 'series',
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' },
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
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: index === 0 ? 'rgba(59, 130, 246, 0.45)' : 'rgba(245, 158, 11, 0.45)',
              },
              {
                offset: 1,
                color: index === 0 ? 'rgba(29, 78, 216, 0.04)' : 'rgba(217, 119, 6, 0.04)',
              },
            ]),
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
          color: '#334155',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: tipo === 'barras' || tipo === 'apiladas' ? 'shadow' : 'line',
          shadowStyle: { color: 'rgba(226, 232, 240, 0.4)' },
          lineStyle: { color: '#94a3b8', type: 'dashed' },
        },
        backgroundColor: '#0f172a',
        borderColor: '#1e293b',
        borderRadius: 8,
        padding: [10, 14],
        textStyle: {
          color: '#f8fafc',
          fontSize: 13,
          fontFamily: 'Inter, system-ui, sans-serif',
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
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
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
            color: '#f1f5f9',
            type: 'solid',
          },
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      },
      series: opcionesSeries,
    };

    this.chart.setOption(option, true);
  }
}
