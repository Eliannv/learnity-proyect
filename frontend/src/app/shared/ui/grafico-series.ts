import { Component, computed, input, signal } from '@angular/core';

export interface SerieGrafico {
  nombre: string;
  /** Un valor por categoría; null = sin dato (la línea se corta, la barra no se dibuja). */
  valores: readonly (number | null)[];
}

// Paleta categórica validada (validate_palette.js, modo claro): azul → ámbar, en ese orden fijo.
// ΔE con daltonismo 32,3 y con visión normal 38,3; ambos con contraste ≥ 3:1 sobre blanco.
const COLORES = ['var(--azul-700)', 'var(--ambar-600)'] as const;

const ANCHO = 640;
const ALTO = 220;
const MARGEN = { arriba: 12, derecha: 12, abajo: 28, izquierda: 36 };

/**
 * Gráfico de líneas o de barras agrupadas (hasta dos series, una sola escala). SVG propio, sin librerías:
 * - leyenda siempre visible con dos series; el color nunca es la única pista (también la tabla de datos);
 * - al pasar el puntero o al enfocar una categoría con el teclado aparece el detalle de esa categoría;
 * - «Ver datos en tabla» ofrece los mismos números a lectores de pantalla e impresión.
 */
@Component({
  selector: 'app-grafico-series',
  template: `
    <figure class="grafico">
      <figcaption class="visualmente-oculto">{{ titulo() }}</figcaption>
      @if (series().length > 1) {
        <ul class="leyenda" aria-hidden="true">
          @for (s of series(); track s.nombre; let i = $index) {
            <li><span class="muestra" [class.linea]="tipo() === 'lineas'" [style.background]="color(i)"></span>{{ s.nombre }}</li>
          }
        </ul>
      }
      <div class="lienzo" (mouseleave)="activo.set(null)">
        <svg [attr.viewBox]="'0 0 ' + ANCHO + ' ' + ALTO" preserveAspectRatio="none" aria-hidden="true">
          @for (t of marcas(); track t.valor) {
            <line class="rejilla" [attr.x1]="M.izquierda" [attr.x2]="ANCHO - M.derecha" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="eje" [attr.x]="M.izquierda - 6" [attr.y]="t.y + 4" text-anchor="end">{{ t.texto }}</text>
          }
          @for (c of categorias(); track $index; let i = $index) {
            @if (mostrarEtiqueta(i)) {
              <text class="eje" [attr.x]="centro(i)" [attr.y]="ALTO - 8" text-anchor="middle">{{ c }}</text>
            }
          }
          @if (activo() !== null && tipo() === 'lineas') {
            <line class="guia" [attr.x1]="centro(activo()!)" [attr.x2]="centro(activo()!)"
              [attr.y1]="M.arriba" [attr.y2]="ALTO - M.abajo" />
          }
          @if (tipo() === 'barras') {
            @for (s of series(); track s.nombre; let si = $index) {
              @for (v of s.valores; track $index; let i = $index) {
                @if (v !== null && v > 0) {
                  <path class="barra" [attr.d]="barra(i, si, v)" [style.fill]="color(si)"
                    [class.atenuada]="activo() !== null && activo() !== i" />
                }
              }
            }
          } @else {
            @for (s of series(); track s.nombre; let si = $index) {
              <path class="trazo" [attr.d]="linea(s.valores)" [style.stroke]="color(si)" />
              @for (v of s.valores; track $index; let i = $index) {
                @if (v !== null) {
                  <circle class="punto" [attr.cx]="centro(i)" [attr.cy]="y(v)" [attr.r]="activo() === i ? 5 : 3.5"
                    [style.fill]="color(si)" />
                }
              }
            }
          }
          <!-- Zonas de contacto más anchas que las marcas: toda la columna de la categoría. -->
          @for (c of categorias(); track $index; let i = $index) {
            <rect class="zona" [attr.x]="M.izquierda + i * paso()" [attr.y]="M.arriba" [attr.width]="paso()"
              [attr.height]="ALTO - M.arriba - M.abajo" (mouseenter)="activo.set(i)" />
          }
        </svg>
        <!-- Equivalente de teclado: cada categoría es enfocable y anuncia sus valores. -->
        <div class="teclado" role="list" [attr.aria-label]="titulo()">
          @for (c of categorias(); track $index; let i = $index) {
            <span role="listitem" tabindex="0" [style.left.%]="(centro(i) / ANCHO) * 100"
              [attr.aria-label]="resumen(i)" (focus)="activo.set(i)" (blur)="activo.set(null)"></span>
          }
        </div>
        @if (activo() !== null) {
          <div class="detalle" [class.izquierda]="centro(activo()!) > ANCHO * 0.6" [style.left.%]="(centro(activo()!) / ANCHO) * 100">
            <strong>{{ etiquetaLarga(activo()!) }}</strong>
            @for (s of series(); track s.nombre; let si = $index) {
              <span><i [style.background]="color(si)"></i>{{ s.nombre }}: <b>{{ texto(s.valores[activo()!] ?? null) }}</b></span>
            }
          </div>
        }
      </div>
      <details class="tabla-datos">
        <summary>Ver datos en tabla</summary>
        <table class="tabla">
          <thead><tr><th scope="col">{{ nombreCategoria() }}</th>
            @for (s of series(); track s.nombre) { <th scope="col">{{ s.nombre }}</th> }</tr></thead>
          <tbody>
            @for (c of categorias(); track $index; let i = $index) {
              <tr><th scope="row">{{ etiquetaLarga(i) }}</th>
                @for (s of series(); track s.nombre) { <td>{{ texto(s.valores[i] ?? null) }}</td> }</tr>
            }
          </tbody>
        </table>
      </details>
    </figure>
  `,
  styles: `
    .grafico { margin: 0; display: grid; gap: 10px; }
    .leyenda { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; padding: 0; list-style: none;
      font-size: 13px; color: var(--tinta-700); }
    .leyenda li { display: inline-flex; align-items: center; gap: 8px; }
    .muestra { display: inline-block; width: 12px; height: 12px; border-radius: 3px; }
    .muestra.linea { height: 3px; width: 16px; border-radius: 2px; }
    .lienzo { position: relative; }
    svg { display: block; width: 100%; height: 220px; overflow: visible; }
    .rejilla { stroke: var(--gris-200); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .eje { font-size: 11px; fill: var(--gris-500); }
    .guia { stroke: var(--gris-400); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
    .trazo { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .punto { stroke: var(--blanco); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .barra { transition: opacity 0.12s; }
    .barra.atenuada { opacity: 0.35; }
    .zona { fill: transparent; }
    .teclado { position: absolute; inset: 0 0 28px 0; pointer-events: none; }
    .teclado span { position: absolute; top: 0; bottom: 0; width: 24px; transform: translateX(-50%); border-radius: 4px; }
    .teclado span:focus-visible { outline: 2px solid var(--azul-700); outline-offset: 2px; }
    .detalle { position: absolute; top: 4px; z-index: 2; transform: translateX(12px); display: grid; gap: 4px;
      min-width: 150px; padding: 10px 12px; border: 1px solid var(--gris-200); border-radius: var(--radio);
      background: var(--blanco); box-shadow: 0 8px 24px rgb(15 23 42 / 12%); font-size: 13px; color: var(--tinta-800);
      pointer-events: none; }
    .detalle.izquierda { transform: translateX(calc(-100% - 12px)); }
    .detalle span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .detalle i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
    .tabla-datos summary { cursor: pointer; font-size: 13px; color: var(--azul-700); font-weight: 600; width: fit-content; }
    .tabla-datos .tabla { margin-top: 10px; font-size: 13px; }
    @media (prefers-reduced-motion: reduce) { .barra { transition: none; } }
  `,
})
export class GraficoSeries {
  readonly tipo = input<'lineas' | 'barras'>('lineas');
  readonly titulo = input.required<string>();
  /** Etiquetas cortas del eje X (p. ej. «may»). */
  readonly categorias = input.required<readonly string[]>();
  /** Etiquetas completas para el detalle y la tabla (p. ej. «mayo de 2026»). */
  readonly categoriasLargas = input<readonly string[]>([]);
  readonly nombreCategoria = input('Mes');
  readonly series = input.required<readonly SerieGrafico[]>();
  /** Escala fija (p. ej. de 1 a 5 estrellas); sin ella va de 0 al máximo de los datos. */
  readonly minimo = input<number | null>(null);
  readonly maximo = input<number | null>(null);
  readonly decimales = input(0);

  protected readonly ANCHO = ANCHO;
  protected readonly ALTO = ALTO;
  protected readonly M = MARGEN;
  protected readonly activo = signal<number | null>(null);

  protected readonly paso = computed(() => (ANCHO - MARGEN.izquierda - MARGEN.derecha) / Math.max(1, this.categorias().length));

  private readonly rango = computed(() => {
    const valores = this.series().flatMap((s) => s.valores).filter((v): v is number => v !== null);
    const min = this.minimo() ?? 0;
    const maxDatos = Math.max(min + 1, ...valores);
    // Techo «redondo» para que las marcas del eje sean números legibles.
    const max = this.maximo() ?? (maxDatos <= 5 ? Math.ceil(maxDatos) : Math.ceil(maxDatos / 5) * 5);
    return { min, max };
  });

  protected readonly marcas = computed(() => {
    const { min, max } = this.rango();
    const pasos = Math.min(4, max - min) || 1;
    return Array.from({ length: pasos + 1 }, (_, k) => {
      const valor = min + ((max - min) * k) / pasos;
      return { valor, y: this.y(valor), texto: this.formato(valor, Number.isInteger(valor) ? 0 : 1) };
    });
  });

  protected color(indice: number): string {
    return COLORES[indice % COLORES.length]!;
  }

  protected centro(i: number): number {
    return MARGEN.izquierda + this.paso() * (i + 0.5);
  }

  protected y(valor: number): number {
    const { min, max } = this.rango();
    const alto = ALTO - MARGEN.arriba - MARGEN.abajo;
    return MARGEN.arriba + alto * (1 - (valor - min) / (max - min || 1));
  }

  /** Con muchas categorías en poco ancho se muestra una de cada dos etiquetas. */
  protected mostrarEtiqueta(i: number): boolean {
    const n = this.categorias().length;
    return n <= 8 || i % 2 === (n - 1) % 2;
  }

  protected linea(valores: readonly (number | null)[]): string {
    let d = '';
    let abierto = false;
    valores.forEach((v, i) => {
      if (v === null) {
        abierto = false;
        return;
      }
      d += `${abierto ? 'L' : 'M'}${this.centro(i).toFixed(1)},${this.y(v).toFixed(1)}`;
      abierto = true;
    });
    return d;
  }

  /** Barra con las esquinas superiores redondeadas (4 px) apoyada en la base; 2 px de separación. */
  protected barra(i: number, serie: number, valor: number): string {
    const n = this.series().length;
    const grupo = Math.min(this.paso() * 0.7, 48);
    const ancho = (grupo - 2 * (n - 1)) / n;
    const x = this.centro(i) - grupo / 2 + serie * (ancho + 2);
    const base = this.y(this.rango().min);
    const tope = this.y(valor);
    const r = Math.min(4, ancho / 2, base - tope);
    return `M${x},${base}V${tope + r}Q${x},${tope} ${x + r},${tope}H${x + ancho - r}Q${x + ancho},${tope} ${x + ancho},${tope + r}V${base}Z`;
  }

  protected texto(valor: number | null): string {
    return valor === null ? 'Sin datos' : this.formato(valor, this.decimales());
  }

  protected etiquetaLarga(i: number): string {
    return this.categoriasLargas().at(i) ?? this.categorias().at(i) ?? '';
  }

  protected resumen(i: number): string {
    return `${this.etiquetaLarga(i)}: ${this.series().map((s) => `${s.nombre} ${this.texto(s.valores[i] ?? null)}`).join(', ')}`;
  }

  private formato(valor: number, decimales: number): string {
    return valor.toLocaleString('es', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  }
}

/** «2026-05» → «may» y «mayo de 2026». */
export function etiquetasMes(meses: readonly string[]): { cortas: string[]; largas: string[] } {
  const fecha = (mes: string) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1);
  return {
    cortas: meses.map((m) => fecha(m).toLocaleDateString('es', { month: 'short' }).replace('.', '')),
    largas: meses.map((m) => fecha(m).toLocaleDateString('es', { month: 'long', year: 'numeric' })),
  };
}
