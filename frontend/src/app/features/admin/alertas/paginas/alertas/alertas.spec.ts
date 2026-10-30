import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { AlertaSeguridad } from '../../../../../core/api/contrato';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AlertasApi } from '../../alertas.api';
import { AdminAlertas } from './alertas';

const intentos: AlertaSeguridad = {
  id: 41, tipo: 'INTENTOS_FALLIDOS', severidad: 'ALTA', detectadaEn: '2026-10-30T05:00:00.000Z',
  descripcion: '10 intentos fallidos de inicio de sesión en la cuenta beto@learnity.test (hasta 10 en 15 minutos).',
  usuario: { id: 5, nombre: 'Beto Ruiz', correo: 'beto@learnity.test' },
  evidencia: { auditoria: [], accesos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, atencion: null,
};
const masiva: AlertaSeguridad = {
  id: 42, tipo: 'MODIFICACION_MASIVA', severidad: 'MEDIA', detectadaEn: '2026-10-30T04:00:00.000Z',
  descripcion: '25 cambios (0 borrados) en el contenido de 1 curso(s) publicado(s) por Carla Docente.',
  usuario: { id: 9, nombre: 'Carla Docente', correo: 'carla@learnity.test' },
  evidencia: { auditoria: [101, 102, 103, 104, 105, 106, 107, 108], accesos: [] }, atencion: null,
};

function montar() {
  const api = {
    listar: vi.fn().mockResolvedValue({
      items: [intentos, masiva], paginacion: { total: 2, pagina: 1, limite: 20, totalPaginas: 1 },
      contadores: { pendientes: 2, todas: 5 },
    }),
    analizar: vi.fn().mockResolvedValue({ nuevas: 3, desde: '2026-10-29T05:00:00.000Z' }),
    atender: vi.fn().mockImplementation((id: number, nota: string | null) => Promise.resolve({
      ...intentos, id, atencion: { fecha: '2026-10-30T06:00:00.000Z', por: { id: 2, nombre: 'Ada Admin' }, nota },
    })),
  };
  const toast = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: AlertasApi, useValue: api }, { provide: ToastService, useValue: toast },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(AdminAlertas);
  fixture.detectChanges();
  return { fixture, api, toast };
}

async function cargada(fixture: ReturnType<typeof montar>['fixture']) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('article.alerta').length).toBe(2);
  });
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

describe('alertas de seguridad', () => {
  it('muestra pestañas con contadores, severidad, tipo, usuario y la evidencia enlazada', async () => {
    const { fixture, api } = montar();
    await cargada(fixture);
    expect(api.listar).toHaveBeenCalledWith({ estado: 'pendientes', severidad: undefined, tipo: undefined, pagina: 1, limite: 20 });
    const pestanas = fixture.nativeElement.querySelector('.pestanas').textContent.replace(/\s+/g, ' ');
    expect(pestanas).toContain('Pendientes 2');
    expect(pestanas).toContain('Todas 5');

    const [primera, segunda] = fixture.nativeElement.querySelectorAll('article.alerta') as NodeListOf<HTMLElement>;
    expect(primera!.textContent).toContain('Alta');
    expect(primera!.textContent).toContain('Intentos fallidos de inicio de sesión');
    expect(primera!.textContent).toContain('Beto Ruiz');
    const accesos = primera!.querySelector('.evidencia a') as HTMLAnchorElement;
    expect(accesos.textContent).toContain('10 accesos fallidos en el registro');
    expect(accesos.getAttribute('href')).toBe('/admin/accesos?q=beto@learnity.test');

    const enlaces = segunda!.querySelectorAll('.evidencia a');
    expect(enlaces.length).toBe(6);
    expect((enlaces[0] as HTMLAnchorElement).getAttribute('href')).toBe('/admin/auditoria?ver=101');
    expect(segunda!.textContent).toContain('y 2 más');
  });

  it('filtra por severidad y tipo, y cambia de pestaña', async () => {
    const { fixture, api } = montar();
    await cargada(fixture);
    const severidad = fixture.nativeElement.querySelector('select[name="severidad"]') as HTMLSelectElement;
    severidad.value = 'ALTA';
    severidad.dispatchEvent(new Event('change'));
    const tipo = fixture.nativeElement.querySelector('select[name="tipo"]') as HTMLSelectElement;
    tipo.value = 'CAMBIO_PRIVILEGIOS';
    tipo.dispatchEvent(new Event('change'));
    boton(fixture.nativeElement, 'Todas').click();
    await vi.waitFor(() => expect(api.listar).toHaveBeenLastCalledWith({
      estado: 'todas', severidad: 'ALTA', tipo: 'CAMBIO_PRIVILEGIOS', pagina: 1, limite: 20,
    }));
  });

  it('«Ejecutar análisis ahora» informa de las nuevas y recarga', async () => {
    const { fixture, api, toast } = montar();
    await cargada(fixture);
    boton(fixture.nativeElement, 'Ejecutar análisis ahora').click();
    await vi.waitFor(() => expect(toast.exito).toHaveBeenCalledWith('Análisis completado: 3 alertas nuevas.'));
    expect(api.analizar).toHaveBeenCalled();
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('«Marcar atendida» guarda la nota, quita la alerta de pendientes y baja el contador', async () => {
    const { fixture, api } = montar();
    await cargada(fixture);
    boton(fixture.nativeElement.querySelector('article.alerta'), 'Marcar atendida').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const modal = fixture.nativeElement.querySelector('app-modal') as HTMLElement;
    const nota = modal.querySelector('textarea') as HTMLTextAreaElement;
    nota.value = '  Bloqueo legítimo: la persona olvidó su contraseña.  ';
    nota.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(modal, 'Marcar atendida').click();
    await vi.waitFor(() => expect(api.atender).toHaveBeenCalledWith(41, 'Bloqueo legítimo: la persona olvidó su contraseña.'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('article.alerta').length).toBe(1);
    });
    expect(fixture.nativeElement.querySelector('.pestanas').textContent.replace(/\s+/g, ' ')).toContain('Pendientes 1');
    expect(fixture.nativeElement.querySelector('app-modal')).toBeNull();
  });
});
