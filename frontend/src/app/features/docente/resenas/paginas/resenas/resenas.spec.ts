import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { BandejaResenas, ResenaDocente } from '../../../../../core/api/contrato';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { CatalogoApi } from '../../../../catalogo/catalogo.api';
import { ResenasApi } from '../../../../catalogo/resenas.api';
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

function montar(api: Partial<Record<keyof DocenteResenasApi, unknown>>, hilo: Partial<Record<keyof ResenasApi, unknown>> = {}) {
  const toasts = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DocenteResenasApi, useValue: api },
      { provide: ResenasApi, useValue: hilo },
      { provide: CatalogoApi, useValue: { categorias: vi.fn().mockResolvedValue([]) } },
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
    expect(texto).toContain('Calificó con 4 estrellas al llevar el 100 % del curso');
    expect(texto).toContain('Reseña editada (antes 2 estrellas, ahora 4 estrellas)');
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

  it('responder publica en el hilo con la insignia «Docente» y descuenta «Sin responder»', async () => {
    const api = { bandeja: vi.fn().mockResolvedValue(bandeja) };
    const hilo = {
      crearRespuestaHilo: vi.fn().mockResolvedValue({
        id: 31, autor: { nombre: 'Luis G.', fotoUrl: null, esDocenteCurso: true }, comentario: '¡Gracias!',
        creadoEn: '2026-10-06T10:00:00.000Z', propia: true,
      }),
    };
    const { fixture, toasts } = montar(api, hilo);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(boton(fixture.nativeElement, 'Responder')).toBeTruthy();
    });
    // Ya no hay dos sistemas: ni «Tu respuesta» aparte, ni «Comentar en hilo», ni «Editar respuesta».
    expect(boton(fixture.nativeElement, 'Comentar en hilo')).toBeUndefined();
    boton(fixture.nativeElement, 'Responder').click();
    fixture.detectChanges();
    await fixture.whenStable(); // NgForm registra el control en una microtarea
    const area = fixture.nativeElement.querySelector('form.responder textarea') as HTMLTextAreaElement;
    area.value = '¡Gracias!';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(boton(fixture.nativeElement, 'Publicar respuesta').disabled).toBe(false);
    fixture.nativeElement.querySelector('form.responder').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(hilo.crearRespuestaHilo).toHaveBeenCalledWith(5, '¡Gracias!'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      const item = fixture.nativeElement.querySelector('.hilo-item') as HTMLElement;
      expect(item?.textContent).toContain('¡Gracias!');
      expect(item.querySelector('.chip-docente')?.textContent).toContain('Docente');
    });
    expect(toasts.exito).toHaveBeenCalledWith('Respuesta publicada.');
    expect(fixture.nativeElement.textContent).not.toContain('Tu respuesta');
    expect(fixture.nativeElement.textContent).not.toContain('Editar respuesta');
    expect(fixture.nativeElement.textContent).toContain('Respondiste todas');
  });

  it('la respuesta clásica del docente se ve en el mismo formato del hilo', async () => {
    const conClasica = {
      ...bandeja,
      items: [{ ...resena, respuesta: { texto: 'Gracias por tu reseña.', fecha: '2026-10-06T10:00:00.000Z' } }],
    };
    const { fixture } = montar({ bandeja: vi.fn().mockResolvedValue(conClasica) });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.hilo-item')?.textContent).toContain('Gracias por tu reseña.');
    });
    const item = fixture.nativeElement.querySelector('.hilo-item') as HTMLElement;
    expect(item.querySelector('.chip-docente')?.textContent).toContain('Docente');
    expect(fixture.nativeElement.querySelector('.respuesta')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Retirar respuesta');
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
