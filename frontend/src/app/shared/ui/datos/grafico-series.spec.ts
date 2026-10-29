import { TestBed } from '@angular/core/testing';
import { GraficoSeries, etiquetasMes } from './grafico-series';

function crear(tipo: 'lineas' | 'barras', valores: (number | null)[][]) {
  const fixture = TestBed.createComponent(GraficoSeries);
  fixture.componentRef.setInput('tipo', tipo);
  fixture.componentRef.setInput('titulo', 'Prueba');
  fixture.componentRef.setInput('categorias', ['ene', 'feb', 'mar']);
  fixture.componentRef.setInput('categoriasLargas', ['enero de 2026', 'febrero de 2026', 'marzo de 2026']);
  fixture.componentRef.setInput('series', valores.map((v, i) => ({ nombre: `Serie ${i + 1}`, valores: v })));
  fixture.detectChanges();
  return fixture;
}

describe('gráfico de series', () => {
  it('con dos series muestra la leyenda y la tabla con los mismos datos', () => {
    const f = crear('barras', [[3, 0, 5], [1, 2, null]]);
    const el: HTMLElement = f.nativeElement;
    expect([...el.querySelectorAll('.leyenda li')].map((li) => li.textContent?.trim())).toEqual(['Serie 1', 'Serie 2']);
    expect(el.querySelectorAll('path.barra').length).toBe(4); // los ceros y nulos no se dibujan
    const filas = [...el.querySelectorAll('.tabla-datos tbody tr')]
      .map((tr) => [...tr.children].map((celda) => celda.textContent?.trim()));
    expect(filas).toEqual([['enero de 2026', '3', '1'], ['febrero de 2026', '0', '2'], ['marzo de 2026', '5', 'Sin datos']]);
  });

  it('con una sola serie no dibuja leyenda: el título la nombra', () => {
    const el: HTMLElement = crear('lineas', [[4, 4.5, 5]]).nativeElement;
    expect(el.querySelector('.leyenda')).toBeNull();
    expect(el.querySelectorAll('circle.punto').length).toBe(3);
  });

  it('al enfocar una categoría con el teclado muestra su detalle y lo anuncia', () => {
    const f = crear('lineas', [[4, null, 5], [3, 3.5, 4]]);
    const objetivos = f.nativeElement.querySelectorAll('.teclado [role="listitem"]');
    expect(objetivos[1].getAttribute('aria-label')).toBe('febrero de 2026: Serie 1 Sin datos, Serie 2 4');
    objetivos[1].dispatchEvent(new Event('focus'));
    f.detectChanges();
    expect(f.nativeElement.querySelector('.detalle')?.textContent).toContain('febrero de 2026');
    objetivos[1].dispatchEvent(new Event('blur'));
    f.detectChanges();
    expect(f.nativeElement.querySelector('.detalle')).toBeNull();
  });

  it('la línea se corta donde falta un dato', () => {
    const d = crear('lineas', [[4, null, 5]]).nativeElement.querySelector('path.trazo')?.getAttribute('d') ?? '';
    expect(d.match(/M/g)?.length).toBe(2);
    expect(d).not.toContain('L');
  });

  it('convierte AAAA-MM en etiquetas cortas y largas', () => {
    const { cortas, largas } = etiquetasMes(['2026-05']);
    expect(cortas[0]).toMatch(/^may/i);
    expect(largas[0]).toMatch(/2026/);
  });
});
