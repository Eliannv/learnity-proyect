import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { Analiticas } from '../../../../../core/api/contrato';
import { Peticion } from '../../../../../core/estado/peticion';
import { Esqueleto } from '../../../../../shared/ui/retroalimentacion/esqueleto';
import { GraficoSeries, etiquetasMes } from '../../../../../shared/ui/datos/grafico-series';
import { GraficoEcharts } from '../../../../../shared/ui/datos/grafico-echarts';
import { Indicador } from '../../../../../shared/ui/datos/indicador';
import { DocenteAnaliticasApi } from '../../analiticas.api';

type LeccionEmbudo = NonNullable<Analiticas['embudo']>[number];

interface GrupoEmbudo {
  modulo: string;
  lecciones: (LeccionEmbudo & { pct: number; caida: number })[];
}

const TIPO: Record<LeccionEmbudo['tipo'], { texto: string; icono: string }> = {
  VIDEO: { texto: 'Vídeo', icono: 'circle-play' },
  DOCUMENTO: { texto: 'PDF', icono: 'file-text' },
  EVALUACION: { texto: 'Evaluación', icono: 'list-checks' },
};

/** Rendimiento de los cursos del docente: actividad mensual, finalización, conversión y embudo por lección. */
@Component({
  selector: 'app-analiticas-docente',
  imports: [DecimalPipe, RouterLink, LucideAngularModule, Esqueleto, GraficoEcharts, Indicador],
  templateUrl: './analiticas.html',
  styleUrl: './analiticas.scss',
})
export class AnaliticasDocente {
  private readonly api = inject(DocenteAnaliticasApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private version = 0;

  protected readonly tipo = TIPO;
  protected readonly carga = new Peticion();
  protected readonly datos = signal<Analiticas | null>(null);
  protected readonly curso = signal<number | null>(Number(this.ruta.snapshot.queryParamMap.get('curso')) || null);

  protected readonly actividad = computed(() => {
    const meses = this.datos()?.actividad ?? [];
    const { cortas, largas } = etiquetasMes(meses.map((m) => m.mes));
    return {
      cortas, largas,
      series: [
        { nombre: 'Inscripciones', valores: meses.map((m) => m.inscripciones) },
        { nombre: 'Cursos completados', valores: meses.map((m) => m.completados) },
      ],
      vacia: meses.every((m) => m.inscripciones === 0 && m.completados === 0),
    };
  });

  protected readonly tasaFinalizacion = computed(() => {
    const r = this.datos()?.resumen;
    return r && r.inscritos ? Math.round((r.completados / r.inscritos) * 100) : null;
  });

  /** Lecciones agrupadas por módulo, con el % de inscritos que la completó y la caída frente a la anterior. */
  protected readonly embudo = computed(() => {
    const d = this.datos();
    if (!d?.embudo) return null;
    const base = d.resumen.inscritos;
    const grupos: GrupoEmbudo[] = [];
    let anterior = base;
    for (const l of d.embudo) {
      const fila = { ...l, pct: base ? Math.round((l.completaron / base) * 100) : 0, caida: Math.max(0, anterior - l.completaron) };
      anterior = l.completaron;
      const grupo = grupos.at(-1);
      if (grupo?.modulo === l.modulo) grupo.lecciones.push(fila);
      else grupos.push({ modulo: l.modulo, lecciones: [fila] });
    }
    return grupos;
  });

  /** La lección donde más estudiantes dejan de avanzar (si alguno lo hace). */
  protected readonly mayorCaida = computed(() => {
    const lecciones = (this.embudo() ?? []).flatMap((g) => g.lecciones);
    const peor = lecciones.reduce<(typeof lecciones)[number] | null>((max, l) => (l.caida > (max?.caida ?? 0) ? l : max), null);
    return peor && peor.caida > 0 ? peor : null;
  });

  constructor() {
    void this.cargar();
  }

  protected cambiarCurso(valor: string): void {
    this.curso.set(valor ? Number(valor) : null);
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: { curso: this.curso() ?? undefined }, replaceUrl: true });
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    const version = ++this.version;
    this.carga.limpiar();
    this.carga.ocupada.set(true);
    try {
      const datos = await this.api.obtener(this.curso());
      if (version === this.version) this.datos.set(datos);
    } catch (error) {
      if (version === this.version) this.carga.fallar(error);
    } finally {
      if (version === this.version) this.carga.ocupada.set(false);
    }
  }

  /** Menos de un día se muestra en horas, para que el valor quepa en la tarjeta y siga diciendo algo. */
  protected dias(valor: number | null): string {
    if (valor === null) return '—';
    if (valor < 1) {
      const horas = Math.round(valor * 24);
      return horas < 1 ? '< 1 h' : `${horas} h`;
    }
    const redondeado = Math.round(valor * 10) / 10;
    return `${redondeado.toLocaleString('es', { maximumFractionDigits: 1 })} ${redondeado === 1 ? 'día' : 'días'}`;
  }

  protected pct(parte: number, total: number): number {
    return total ? Math.round((parte / total) * 100) : 0;
  }
}
