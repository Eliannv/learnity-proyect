import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { CambioAuditoria, DetalleCambioAuditoria } from '../../../../../core/api/contrato';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { AuditoriaApi } from '../../auditoria.api';
import { AdminAuditoria } from './auditoria';

const cambio: CambioAuditoria = {
  id: 77, fecha: '2026-10-29T15:00:00.000Z', tabla: 'categoria', operacion: 'UPDATE', registro: '4',
  actor: { id: 2, nombre: 'Ada Admin', correo: 'ada@learnity.test' }, usuarioBd: 'learnity_app',
  columnasCambiadas: ['nombre', 'actualizado_en'],
};

const detalle: DetalleCambioAuditoria = {
  ...cambio, idTransaccion: 9911,
  antes: { id_categoria: 4, nombre: 'Diseño', actualizado_en: '2026-10-01T10:00:00Z' },
  despues: { id_categoria: 4, nombre: 'Diseño gráfico', actualizado_en: '2026-10-29T15:00:00Z' },
};

function montar() {
  const api = {
    listar: vi.fn().mockResolvedValue({ items: [cambio], paginacion: { total: 1, pagina: 1, limite: 25, totalPaginas: 1 } }),
    detalle: vi.fn().mockResolvedValue(detalle),
    opciones: vi.fn().mockResolvedValue({
      tablas: ['categoria', 'curso'], usuariosBd: ['learnity_app', 'postgres'], actores: [{ id: 2, nombre: 'Ada Admin' }],
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuditoriaApi, useValue: api },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(AdminAuditoria);
  fixture.detectChanges();
  return { fixture, api };
}

async function esperar(fixture: ReturnType<typeof montar>['fixture'], texto: string) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(texto);
  });
}

const select = (el: HTMLElement, nombre: string) => el.querySelector(`select[name="${nombre}"]`) as HTMLSelectElement;
const BASE = { pagina: 1, limite: 25, tabla: undefined, operacion: undefined, usuarioBd: undefined, actor: undefined, desde: undefined, hasta: undefined };

describe('visor de auditoría', () => {
  it('lista los cambios con actor, rol de la base y columnas, y filtra por tabla, operación, rol y actor', async () => {
    const { fixture, api } = montar();
    await esperar(fixture, '1 cambios');
    const fila = (fixture.nativeElement.querySelector('tbody tr') as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(fila).toContain('categoria');
    expect(fila).toContain('UPDATE');
    expect(fila).toContain('Ada Admin');
    expect(fila).toContain('learnity_app');
    expect(fila).toContain('nombre, actualizado_en');
    expect(api.listar).toHaveBeenCalledWith(BASE);

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(select(fixture.nativeElement, 'tabla').options.length).toBe(3);
    });
    for (const [nombre, valor] of [['tabla', 'curso'], ['operacion', 'DELETE'], ['usuarioBd', 'postgres'], ['actor', '2']]) {
      const s = select(fixture.nativeElement, nombre!);
      s.value = valor!;
      s.dispatchEvent(new Event('change'));
    }
    await vi.waitFor(() => expect(api.listar).toHaveBeenLastCalledWith({
      ...BASE, tabla: 'curso', operacion: 'DELETE', usuarioBd: 'postgres', actor: 2,
    }));
  });

  it('las fechas van como medianoche local: «Hasta» incluye todo ese día; si están al revés, avisa y no consulta', async () => {
    const { fixture, api } = montar();
    await esperar(fixture, '1 cambios');
    const fecha = (nombre: string, valor: string) => {
      const input = fixture.nativeElement.querySelector(`input[name="${nombre}"]`) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    };
    fecha('desde', '2026-10-01');
    fecha('hasta', '2026-10-03');
    await vi.waitFor(() => expect(api.listar).toHaveBeenLastCalledWith({
      ...BASE, desde: new Date(2026, 9, 1).toISOString(), hasta: new Date(2026, 9, 4).toISOString(),
    }));

    const llamadas = api.listar.mock.calls.length;
    fecha('desde', '2026-10-05');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('«Desde» debe ser anterior o igual a «Hasta».');
    expect(api.listar.mock.calls.length).toBe(llamadas);
  });

  it('el detalle muestra los metadatos y el antes y después, con texto además del color', async () => {
    const { fixture, api } = montar();
    await esperar(fixture, '1 cambios');
    (fixture.nativeElement.querySelector('tbody button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(api.detalle).toHaveBeenCalledWith(77));
    await esperar(fixture, '9911');
    const modal = fixture.nativeElement.querySelector('app-modal') as HTMLElement;
    const texto = modal.textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Cambio 77 · categoria');
    expect(texto).toContain('Ada Admin · ada@learnity.test');
    expect(texto).toContain('Mostrar solo las columnas que cambiaron (2 de 3)');

    const antes = modal.querySelector('td.antes') as HTMLElement;
    const despues = modal.querySelector('td.despues') as HTMLElement;
    expect(antes.textContent).toContain('Valor anterior:');
    expect(antes.textContent).toContain('Diseño');
    expect(despues.textContent).toContain('Valor nuevo:');
    expect(despues.textContent).toContain('Diseño gráfico');
    expect(modal.querySelectorAll('tbody tr').length).toBe(2);

    (modal.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(modal.querySelectorAll('tbody tr').length).toBe(3);
  });
});
