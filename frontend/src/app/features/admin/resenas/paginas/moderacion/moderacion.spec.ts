import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { ReporteResena, ResenaAdmin } from '../../../../../core/api/contrato';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AdminResenasApi } from '../../resenas.api';
import { ModeracionResenas } from './moderacion';

const reporte: ReporteResena = {
  id: 3, motivo: 'OFENSIVO', detalle: 'Insulta al docente.', estado: 'PENDIENTE',
  creadoEn: '2026-10-20T10:00:00.000Z', resueltoEn: null, reportadoPor: 'Carlos Docente',
  resena: {
    id: 9, curso: { id: 7, titulo: 'Álgebra' }, estudiante: 'Beto Ruiz', estrellas: 1,
    comentario: 'Texto ofensivo', eliminadaEn: null, ocultacion: null,
    respuesta: { texto: 'Lamento tu experiencia.', fecha: '2026-10-03T10:00:00.000Z' },
  },
  historial: [
    { accion: 'CREADA', fecha: '2026-10-01T10:00:00.000Z', actor: { id: 1, nombre: 'Beto Ruiz' },
      estrellasAnterior: null, estrellasNueva: 3, comentarioAnterior: null, comentarioNuevo: 'Bien', motivo: null },
    { accion: 'EDITADA', fecha: '2026-10-02T10:00:00.000Z', actor: { id: 1, nombre: 'Beto Ruiz' },
      estrellasAnterior: 3, estrellasNueva: 1, comentarioAnterior: 'Bien', comentarioNuevo: 'Texto ofensivo', motivo: null },
  ],
};

const resena: ResenaAdmin = {
  ...reporte.resena, creadoEn: reporte.historial[0]!.fecha, reportesPendientes: 1, historial: reporte.historial,
};

const ocultadaEn = '2026-10-21T10:00:00.000Z';
const ocultada: ResenaAdmin = {
  ...resena, reportesPendientes: 0,
  ocultacion: { fecha: ocultadaEn, motivo: 'Insultos al docente.', por: { id: 2, nombre: 'Ada Admin' } },
  historial: [...resena.historial, {
    accion: 'OCULTADA', fecha: ocultadaEn, actor: { id: 2, nombre: 'Ada Admin' },
    estrellasAnterior: 1, estrellasNueva: 1, comentarioAnterior: 'Texto ofensivo', comentarioNuevo: 'Texto ofensivo',
    motivo: 'Insultos al docente.',
  }],
};

function montar(confirmar: boolean, items: ResenaAdmin[] = [resena], consulta: Record<string, string> = {}) {
  const api = {
    todas: vi.fn().mockResolvedValue({
      cursos: [{ id: 7, titulo: 'Álgebra' }], items, pagina: 1, limite: 20, total: items.length, totalPaginas: 1,
    }),
    reportes: vi.fn().mockResolvedValue([reporte]),
    resolver: vi.fn().mockResolvedValue(undefined),
    ocultar: vi.fn().mockResolvedValue(ocultada),
    restaurar: vi.fn().mockResolvedValue({ ...ocultada, ocultacion: null }),
    retirarRespuesta: vi.fn().mockResolvedValue({ ...resena, respuesta: null }),
  };
  const toasts = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: AdminResenasApi, useValue: api }, { provide: ToastService, useValue: toasts },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
      { provide: ConfirmacionService, useValue: { confirmar: vi.fn().mockResolvedValue(confirmar) } },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(ModeracionResenas);
  fixture.detectChanges();
  return { fixture, api, toasts };
}

type Montaje = ReturnType<typeof montar>['fixture'];

async function esperarTodas(fixture: Montaje) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 reseña');
  });
}

/** Abre la pestaña de reportes pendientes (la página empieza en «Todas las reseñas»). */
async function irAPendientes(fixture: Montaje) {
  await esperarTodas(fixture);
  boton(fixture.nativeElement, 'Reportes pendientes').click();
  fixture.detectChanges();
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

const FILTROS = { estado: 'todas', curso: null, estrellas: null, categoria: '', q: '' };

describe('reseñas del administrador', () => {
  it('abre en «Todas las reseñas» con su estado e historial y filtra por estado y estrellas', async () => {
    const { fixture, api } = montar(true);
    await esperarTodas(fixture);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Publicada');
    expect(texto).toContain('Reporte pendiente');
    expect(fixture.nativeElement.querySelector('.historial')?.textContent).toContain('Historial completo (2)');
    expect(api.todas).toHaveBeenCalledWith(FILTROS, 1);

    const [estado, estrellas] = fixture.nativeElement.querySelectorAll('.filtros select') as NodeListOf<HTMLSelectElement>;
    estado!.value = 'ocultadas';
    estado!.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(api.todas).toHaveBeenLastCalledWith({ ...FILTROS, estado: 'ocultadas' }, 1));
    estrellas!.selectedIndex = 1;
    estrellas!.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(api.todas).toHaveBeenLastCalledWith({ ...FILTROS, estado: 'ocultadas', estrellas: 5 }, 1));
    fixture.detectChanges();
    expect(boton(fixture.nativeElement, 'Limpiar filtros')).toBeTruthy();
  });

  it('la búsqueda de texto espera a que se deje de escribir', async () => {
    const { fixture, api } = montar(true);
    await esperarTodas(fixture);
    const campo = fixture.nativeElement.querySelector('.filtros input[name="q"]') as HTMLInputElement;
    campo.value = 'ofensivo';
    campo.dispatchEvent(new Event('input'));
    expect(api.todas).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(api.todas).toHaveBeenLastCalledWith({ ...FILTROS, q: 'ofensivo' }, 1));
  });

  it('oculta desde «Todas» con un motivo obligatorio y muestra quién y por qué', async () => {
    const { fixture, api, toasts } = montar(true);
    await esperarTodas(fixture);
    boton(fixture.nativeElement, 'Ocultar reseña').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const modal = fixture.nativeElement.querySelector('app-modal') as HTMLElement;
    expect(modal.textContent).toContain('el estudiante no lo ve');

    boton(modal, 'Ocultar reseña').click();
    fixture.detectChanges();
    expect(api.ocultar).not.toHaveBeenCalled();
    expect(modal.textContent).toContain('Escribe el motivo de la ocultación.');

    const motivo = modal.querySelector('textarea') as HTMLTextAreaElement;
    motivo.value = '  Insultos al docente.  ';
    motivo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(modal, 'Ocultar reseña').click();
    await vi.waitFor(() => expect(api.ocultar).toHaveBeenCalledWith(9, 'Insultos al docente.'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-modal')).toBeNull();
    });
    const texto = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(texto).toContain('Ocultada');
    expect(texto).toContain('por Ada Admin. Motivo: Insultos al docente.');
    expect(texto).toContain('Ocultó la reseña · Ada Admin');
    expect(boton(fixture.nativeElement, 'Restaurar reseña')).toBeTruthy();
    expect(toasts.exito).toHaveBeenCalledWith('Reseña ocultada. Ya no se ve en el curso.');
  });

  it('restaura una ocultada y retira la respuesta del docente tras confirmar', async () => {
    const { fixture, api } = montar(true, [ocultada]);
    await esperarTodas(fixture);
    boton(fixture.nativeElement, 'Restaurar reseña').click();
    await vi.waitFor(() => expect(api.restaurar).toHaveBeenCalledWith(9));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(boton(fixture.nativeElement, 'Ocultar reseña')).toBeTruthy();
    });

    boton(fixture.nativeElement, 'Retirar respuesta del docente').click();
    await vi.waitFor(() => expect(api.retirarRespuesta).toHaveBeenCalledWith(9));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Lamento tu experiencia.');
    });
  });

  it('si no confirma, no restaura ni retira nada', async () => {
    const { fixture, api } = montar(false, [ocultada]);
    await esperarTodas(fixture);
    boton(fixture.nativeElement, 'Restaurar reseña').click();
    boton(fixture.nativeElement, 'Retirar respuesta del docente').click();
    await fixture.whenStable();
    expect(api.restaurar).not.toHaveBeenCalled();
    expect(api.retirarRespuesta).not.toHaveBeenCalled();
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
    expect(historial).toContain('Publicó la reseña · Beto Ruiz · 3 estrellas');
    expect(historial).toContain('Editó la reseña · Beto Ruiz · 3 estrellas → 1 estrella');
  });

  it('ocultar un reporte pide confirmación, resuelve y quita el reporte de la lista', async () => {
    const { fixture, api, toasts } = montar(true);
    await irAPendientes(fixture);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Reportada por');
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

  it('con ?vista=PENDIENTE (desde el resumen) abre directamente los reportes pendientes', async () => {
    const { fixture, api } = montar(true, [resena], { vista: 'PENDIENTE' });
    await vi.waitFor(() => expect(api.reportes).toHaveBeenCalledWith('PENDIENTE'));
    expect(api.todas).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(boton(fixture.nativeElement, 'Reportes pendientes').getAttribute('aria-selected')).toBe('true');
  });
});
