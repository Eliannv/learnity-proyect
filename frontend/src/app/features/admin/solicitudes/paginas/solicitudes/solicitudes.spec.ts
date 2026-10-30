import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { type SolicitudDocente, SolicitudesDocenteService } from '../../../../../core/solicitudes/solicitudes-docente.service';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { Solicitudes } from './solicitudes';

const aprobada: SolicitudDocente = {
  id: 4, estado: 'APROBADA', especialidad: 'Programación web', motivo: 'Quiero enseñar programación web desde cero.',
  observacion: null, enviadaEn: '2026-10-01T10:00:00.000Z', revisadaEn: '2026-10-02T10:00:00.000Z', revocacion: null,
  cursosPublicados: 2,
  solicitante: { nombres: 'Carlos', apellidos: 'Ruiz', correo: 'carlos@learnity.test', estudianteDesde: '2026-01-01T10:00:00.000Z',
    cursosCompletados: 3 },
};

function montar() {
  const api = {
    listar: vi.fn().mockImplementation((estado: string) => Promise.resolve(estado === 'APROBADA' ? [aprobada] : [])),
    revocar: vi.fn().mockResolvedValue({ ...aprobada, estado: 'REVOCADA' }),
    decidir: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: SolicitudesDocenteService, useValue: api },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(Solicitudes);
  fixture.detectChanges();
  return { fixture, api, el: fixture.nativeElement as HTMLElement };
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(texto)) as HTMLButtonElement;

async function esperar(fixture: ReturnType<typeof montar>['fixture'], texto: string) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(texto);
  });
}

describe('solicitudes de docente: revocación (D3)', () => {
  it('avisa de los cursos publicados, exige el motivo y revoca', async () => {
    const { fixture, api, el } = montar();
    await esperar(fixture, 'No hay solicitudes pendientes');
    boton(el, 'Aprobadas').click();
    await esperar(fixture, 'Revocar rol docente');

    boton(el, 'Revocar rol docente').click();
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel se registra en el formulario de forma asíncrona
    const modal = el.querySelector('app-modal')!;
    expect(modal.textContent).toContain('2 cursos publicados');
    expect(modal.textContent).toContain('Seguirán publicados, pero ya no podrá editarlos');

    const enviar = () => (modal.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    enviar();
    fixture.detectChanges();
    expect(api.revocar).not.toHaveBeenCalled();
    expect(modal.textContent).toContain('Escribe el motivo para poder revocar.');

    const motivo = modal.querySelector<HTMLTextAreaElement>('#motivo-revocacion')!;
    motivo.value = '  Material con derechos de autor.  ';
    motivo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    enviar();
    await vi.waitFor(() => expect(api.revocar).toHaveBeenCalledWith(4, 'Material con derechos de autor.'));
    await esperar(fixture, 'Carlos ya no es docente.');
    expect(el.querySelector('app-modal')).toBeNull();
  });

  it('una solicitud revocada muestra el motivo y la fecha', async () => {
    const { fixture, api, el } = montar();
    api.listar.mockImplementation((estado: string) => Promise.resolve(estado === 'REVOCADA'
      ? [{ ...aprobada, estado: 'REVOCADA', revocacion: { revocadaEn: '2026-10-29T10:00:00.000Z', motivo: 'Material con derechos de autor.' } }]
      : []));
    await esperar(fixture, 'No hay solicitudes pendientes');
    boton(el, 'Revocadas').click();
    await esperar(fixture, 'Motivo: Material con derechos de autor.');
    expect(el.querySelector('.estado.revocada')?.textContent).toContain('Revocada');
    expect(boton(el, 'Revocar rol docente')).toBeUndefined();
  });
});
