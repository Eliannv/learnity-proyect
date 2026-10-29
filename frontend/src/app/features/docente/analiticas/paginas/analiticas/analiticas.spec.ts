import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { Analiticas } from '../../../../../core/api/contrato';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { GraficoEcharts } from '../../../../../shared/ui/datos/grafico-echarts';
import type { SerieGrafico } from '../../../../../shared/ui/datos/grafico-series';
import { DocenteAnaliticasApi } from '../../analiticas.api';
import { AnaliticasDocente } from './analiticas';

/** jsdom no tiene <canvas>: un doble de ECharts que solo expone los datos recibidos. */
@Component({
  selector: 'app-grafico-echarts',
  template: '@for (s of series(); track s.nombre) { <span class="serie-doble">{{ s.nombre }}: {{ s.valores.join(",") }}</span> }',
})
class GraficoEchartsDoble {
  readonly titulo = input('');
  readonly categorias = input<readonly string[]>([]);
  readonly categoriasLargas = input<readonly string[] | undefined>(undefined);
  readonly series = input<readonly SerieGrafico[]>([]);
}

function sinCanvas(): void {
  TestBed.overrideComponent(AnaliticasDocente, {
    remove: { imports: [GraficoEcharts] },
    add: { imports: [GraficoEchartsDoble] },
  });
}

const meses = Array.from({ length: 12 }, (_, i) => ({ mes: `2026-${String(i + 1).padStart(2, '0')}`, inscripciones: i === 9 ? 10 : 0, completados: i === 9 ? 2 : 0 }));

const deCurso: Analiticas = {
  cursos: [{ id: 7, titulo: 'Álgebra' }],
  resumen: { inscritos: 10, completados: 2, diasPromedioFinalizacion: 3.5, diasMedianaFinalizacion: 3 },
  actividad: meses,
  conversion: { dias: 30, visitas: 40, inscripciones: 10, tasaPct: 25 },
  embudo: [
    { leccionId: 1, modulo: 'Inicio', titulo: 'Bienvenida', tipo: 'VIDEO', completaron: 9 },
    { leccionId: 2, modulo: 'Inicio', titulo: 'Guía en PDF', tipo: 'DOCUMENTO', completaron: 8 },
    { leccionId: 3, modulo: 'Práctica', titulo: 'Ejercicios', tipo: 'EVALUACION', completaron: 3 },
  ],
  porCurso: null,
};

describe('analíticas del docente', () => {
  it('agrupa el embudo por módulo y señala dónde abandonan más', async () => {
    const api = { obtener: vi.fn().mockResolvedValue(deCurso) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DocenteAnaliticasApi, useValue: api },
        { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }],
    });
    sinCanvas();
    const fixture = TestBed.createComponent(AnaliticasDocente);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Retención por lección');
    });
    const el: HTMLElement = fixture.nativeElement;
    expect([...el.querySelectorAll('.modulo h3')].map((h) => h.textContent)).toEqual(['Inicio', 'Práctica']);
    expect(el.querySelector('.alerta')?.textContent?.replace(/\s+/g, ' ')).toContain('«Ejercicios» es donde más estudiantes se quedan: 5 llegaron hasta ahí');
    expect(el.textContent).toContain('3,5 días');
    expect(el.querySelector('li.peor')?.textContent).toContain('30 %');
    expect(el.textContent).toContain('20 % de los inscritos');
    expect(el.textContent).toContain('10 inscripciones de 40 vistas');
    expect([...el.querySelectorAll('.serie-doble')].map((x) => x.textContent)).toEqual([
      'Inscripciones: 0,0,0,0,0,0,0,0,0,10,0,0', 'Cursos completados: 0,0,0,0,0,0,0,0,0,2,0,0',
    ]);
  });

  it('sin curso elegido compara los cursos y permite abrir el detalle de uno', async () => {
    const api = { obtener: vi.fn()
      .mockResolvedValueOnce({ ...deCurso, embudo: null, porCurso: [{ id: 7, titulo: 'Álgebra', inscritos: 10, completados: 2 }] })
      .mockResolvedValueOnce(deCurso) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DocenteAnaliticasApi, useValue: api },
        { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }],
    });
    sinCanvas();
    const fixture = TestBed.createComponent(AnaliticasDocente);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Comparación entre tus cursos');
    });
    expect(api.obtener).toHaveBeenCalledWith(null);
    ([...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Ver detalle'))!.click();
    await vi.waitFor(() => expect(api.obtener).toHaveBeenLastCalledWith(7));
  });
});
