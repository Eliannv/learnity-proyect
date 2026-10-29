import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { BandejaResenas, ResenaDocente } from '../../../../../core/api/contrato';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { DocenteResenasApi } from '../../resenas.api';
import { ResenasDocente } from './resenas';

const resena: ResenaDocente = {
  id: 5, curso: { id: 7, titulo: 'Álgebra' }, estudiante: 'Ana Pérez', fotoUrl: null,
  estrellas: 4, estrellasOriginales: 2, comentario: 'Mejoró mucho.', creadoEn: '2026-10-01T10:00:00.000Z',
  editado: true, editadoEn: '2026-10-05T10:00:00.000Z', progresoAlResenar: 100, respuesta: null, reporte: null,
};

const bandeja: BandejaResenas = {
  cursos: [{ id: 7, titulo: 'Álgebra' }],
  resumen: { promedio: 4, total: 1, distribucion: [0, 0, 0, 1, 0], sinResponder: 1 },
  evolucion: [{ mes: '2026-10', total: 1, promedio: 4, promedioAcumulado: 4 }],
  items: [resena], pagina: 1, limite: 10, total: 1, totalPaginas: 1,
};

function montar(api: Partial<Record<keyof DocenteResenasApi, unknown>>) {
  const toasts = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DocenteResenasApi, useValue: api },
      { provide: ToastService, useValue: toasts },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(ResenasDocente);
  fixture.detectChanges();
  return { fixture, toasts };
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

describe('bandeja de reseñas del docente', () => {
  it('muestra el avance al reseñar y la edición «antes / ahora»', async () => {
    const { fixture } = montar({ bandeja: vi.fn().mockResolvedValue(bandeja) });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Ana Pérez');
    });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Calificó con 4 ★ al llevar el 100 % del curso');
    expect(texto).toContain('Reseña editada (antes 2 ★, ahora 4 ★)');
    expect(texto).toContain('El gráfico aparece cuando haya reseñas en al menos dos meses distintos.');
  });

  it('filtrar por estrellas vuelve a pedir la primera página con ese filtro', async () => {
    const api = { bandeja: vi.fn().mockResolvedValue(bandeja) };
    const { fixture } = montar(api);
    await vi.waitFor(() => expect(api.bandeja).toHaveBeenCalledTimes(1));
    const select = fixture.nativeElement.querySelector('select[name="estrellas"]') as HTMLSelectElement;
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(api.bandeja).toHaveBeenLastCalledWith({ pagina: 1, estrellas: 4, limite: 10 }));
  });

  it('publica una respuesta y la muestra sin recargar', async () => {
    const api = {
      bandeja: vi.fn().mockResolvedValue(bandeja),
      responder: vi.fn().mockResolvedValue({ ...resena, respuesta: { texto: '¡Gracias!', fecha: '2026-10-06T10:00:00.000Z' } }),
    };
    const { fixture, toasts } = montar(api);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(boton(fixture.nativeElement, 'Responder')).toBeTruthy();
    });
    boton(fixture.nativeElement, 'Responder').click();
    fixture.detectChanges();
    await fixture.whenStable(); // NgForm registra el control en una microtarea
    const area = fixture.nativeElement.querySelector('textarea[name="respuesta"]') as HTMLTextAreaElement;
    area.value = '¡Gracias!';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(boton(fixture.nativeElement, 'Publicar respuesta').disabled).toBe(false);
    fixture.nativeElement.querySelector('form.responder').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(api.responder).toHaveBeenCalledWith(5, '¡Gracias!'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.respuesta')?.textContent).toContain('¡Gracias!');
    });
    expect(toasts.exito).toHaveBeenCalledWith('Respuesta publicada.');
    expect(fixture.nativeElement.textContent).toContain('Editar respuesta');
  });

  it('reportar exige un motivo y luego marca la reseña como en revisión', async () => {
    const api = {
      bandeja: vi.fn().mockResolvedValue(bandeja),
      reportar: vi.fn().mockResolvedValue({ ...resena, reporte: { estado: 'PENDIENTE', motivo: 'SPAM' } }),
    };
    const { fixture } = montar(api);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(boton(fixture.nativeElement, 'Reportar')).toBeTruthy();
    });
    boton(fixture.nativeElement, 'Reportar').click();
    fixture.detectChanges();
    boton(document.body, 'Enviar reporte').click();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Elige el motivo del reporte.');
    expect(api.reportar).not.toHaveBeenCalled();

    (document.querySelector('input[value="SPAM"]') as HTMLInputElement).dispatchEvent(new Event('change'));
    boton(document.body, 'Enviar reporte').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Reportada · en revisión');
    });
    expect(api.reportar).toHaveBeenCalledWith(5, { motivo: 'SPAM', detalle: null });
  });
});
