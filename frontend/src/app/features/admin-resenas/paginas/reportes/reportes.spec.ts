import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { ReporteResena } from '../../../../core/api/contrato';
import { ConfirmacionService } from '../../../../shared/ui/confirmacion.service';
import { ICONOS } from '../../../../shared/ui/iconos';
import { ToastService } from '../../../../shared/ui/toast.service';
import { AdminResenasApi } from '../../admin-resenas.api';
import { ReportesResenas } from './reportes';

const reporte: ReporteResena = {
  id: 3, motivo: 'OFENSIVO', detalle: 'Insulta al docente.', estado: 'PENDIENTE',
  creadoEn: '2026-10-20T10:00:00.000Z', resueltoEn: null, reportadoPor: 'Carlos Docente',
  resena: {
    id: 9, curso: { id: 7, titulo: 'Álgebra' }, estudiante: 'Beto Ruiz', estrellas: 1,
    comentario: 'Texto ofensivo', eliminadaEn: null, respuesta: null,
  },
  historial: [
    { accion: 'CREADA', fecha: '2026-10-01T10:00:00.000Z', actor: { id: 1, nombre: 'Beto Ruiz' },
      estrellasAnterior: null, estrellasNueva: 3, comentarioAnterior: null, comentarioNuevo: 'Bien' },
    { accion: 'EDITADA', fecha: '2026-10-02T10:00:00.000Z', actor: { id: 1, nombre: 'Beto Ruiz' },
      estrellasAnterior: 3, estrellasNueva: 1, comentarioAnterior: 'Bien', comentarioNuevo: 'Texto ofensivo' },
  ],
};

function montar(confirmar: boolean) {
  const api = {
    todas: vi.fn().mockResolvedValue({
      items: [{ ...reporte.resena, creadoEn: reporte.historial[0]!.fecha, reportesPendientes: 1, historial: reporte.historial }],
      pagina: 1, limite: 20, total: 1, totalPaginas: 1,
    }),
    reportes: vi.fn().mockResolvedValue([reporte]),
    resolver: vi.fn().mockResolvedValue(undefined),
  };
  const toasts = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: AdminResenasApi, useValue: api }, { provide: ToastService, useValue: toasts },
      { provide: ConfirmacionService, useValue: { confirmar: vi.fn().mockResolvedValue(confirmar) } },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(ReportesResenas);
  fixture.detectChanges();
  return { fixture, api, toasts };
}

/** Abre la pestaña de reportes pendientes (la página empieza en «Todas las reseñas»). */
async function irAPendientes(fixture: ReturnType<typeof montar>['fixture']) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 reseña');
  });
  boton(fixture.nativeElement, 'Reportes pendientes').click();
  fixture.detectChanges();
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

describe('reseñas del administrador', () => {
  it('abre en «Todas las reseñas» con su estado e historial y filtra por borradas', async () => {
    const { fixture, api } = montar(true);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('1 reseña');
    });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Publicada');
    expect(texto).toContain('Reporte pendiente');
    expect(fixture.nativeElement.querySelector('.historial')?.textContent).toContain('Historial completo (2)');
    expect(api.todas).toHaveBeenCalledWith('todas', 1);
    const select = fixture.nativeElement.querySelector('.filtro select') as HTMLSelectElement;
    select.value = 'borradas';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(api.todas).toHaveBeenLastCalledWith('borradas', 1));
  });

  it('muestra el historial con quién hizo cada cambio y el antes / después', async () => {
    const { fixture } = montar(true);
    await irAPendientes(fixture);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Reportada por');
    });
    const historial = fixture.nativeElement.querySelector('.historial')?.textContent?.replace(/\s+/g, ' ');
    expect(historial).toContain('Historial completo (2)');
    expect(historial).toContain('Publicó la reseña · Beto Ruiz · 3 ★');
    expect(historial).toContain('Editó la reseña · Beto Ruiz · 3 ★ → 1 ★');
  });

  it('ocultar pide confirmación, resuelve y quita el reporte de la lista', async () => {
    const { fixture, api, toasts } = montar(true);
    await irAPendientes(fixture);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(boton(fixture.nativeElement, 'Ocultar reseña')).toBeTruthy();
    });
    boton(fixture.nativeElement, 'Ocultar reseña').click();
    await vi.waitFor(() => expect(api.resolver).toHaveBeenCalledWith(3, 'OCULTAR'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No hay reportes pendientes');
    });
    expect(toasts.exito).toHaveBeenCalledWith('Reseña ocultada.');
  });

  it('si no confirma, no resuelve nada', async () => {
    const { fixture, api } = montar(false);
    await irAPendientes(fixture);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(boton(fixture.nativeElement, 'Desestimar reporte')).toBeTruthy();
    });
    boton(fixture.nativeElement, 'Desestimar reporte').click();
    await fixture.whenStable();
    expect(api.resolver).not.toHaveBeenCalled();
  });
});
