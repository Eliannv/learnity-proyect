import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { SesionAdmin } from '../../../../../core/api/contrato';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { SesionesApi } from '../../sesiones.api';
import { formatearBytes, tiempoEnLinea } from './formato';
import { AdminSesiones } from './sesiones';

const ajena: SesionAdmin = {
  id: '11111111-1111-4111-8111-111111111111',
  usuario: { id: 5, nombre: 'Beto Ruiz', correo: 'beto@learnity.test', roles: ['ESTUDIANTE', 'DOCENTE'] },
  agente: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  iniciadaEn: '2026-10-29T10:00:00.000Z', renovadaEn: '2026-10-29T12:00:00.000Z', expiraEn: '2026-11-05T12:00:00.000Z',
  actual: false,
};
const propia: SesionAdmin = {
  ...ajena, id: '22222222-2222-4222-8222-222222222222', actual: true,
  usuario: { id: 2, nombre: 'Ada Admin', correo: 'ada@learnity.test', roles: ['ADMIN', 'ESTUDIANTE'] },
};

function montar(confirmar = true) {
  const api = {
    estadoBaseDatos: vi.fn().mockResolvedValue({
      version: '17.10', tamanoBytes: 12 * 1024 * 1024, conexiones: 7, iniciadaEn: '2026-10-27T08:00:00.000Z',
      ultimaMigracion: { version: '037_supervision_auditoria', aplicadaEn: '2026-10-30T05:00:00.000Z' },
    }),
    listar: vi.fn().mockResolvedValue({ items: [propia, ajena], paginacion: { total: 2, pagina: 1, limite: 20, totalPaginas: 1 } }),
    revocar: vi.fn().mockResolvedValue(undefined),
  };
  const auth = { cerrarSesion: vi.fn().mockResolvedValue(undefined) };
  const confirmacion = { confirmar: vi.fn().mockResolvedValue(confirmar) };
  TestBed.configureTestingModule({
    providers: [
      { provide: SesionesApi, useValue: api }, { provide: AuthService, useValue: auth },
      { provide: ConfirmacionService, useValue: confirmacion },
      { provide: ToastService, useValue: { exito: vi.fn(), error: vi.fn() } },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(AdminSesiones);
  fixture.detectChanges();
  return { fixture, api, auth, confirmacion };
}

async function cargada(fixture: ReturnType<typeof montar>['fixture']) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 sesiones');
    expect(fixture.nativeElement.textContent).toContain('17.10');
  });
}

const boton = (fila: Element) => fila.querySelector('button') as HTMLButtonElement;

describe('sesiones y base de datos', () => {
  it('muestra el estado de la base y las sesiones con roles, navegador y la propia marcada', async () => {
    const { fixture } = montar();
    await cargada(fixture);
    const estado = fixture.nativeElement.querySelector('.indicadores').textContent.replace(/\s+/g, ' ');
    expect(estado).toContain('12 MB');
    expect(estado).toMatch(/Conexiones abiertas\s*7(?!\d)/);
    expect(estado).toContain('037_supervision_auditoria');
    const [fila1, fila2] = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(fila1.textContent).toContain('Tu sesión actual');
    expect(fila2.textContent).toContain('Estudiante');
    expect(fila2.textContent).toContain('Docente');
    expect(fila2.textContent).toContain('Chrome 130 · Windows');
  });

  it('cierra una sesión ajena tras confirmar y la quita de la lista', async () => {
    const { fixture, api, auth, confirmacion } = montar();
    await cargada(fixture);
    boton(fixture.nativeElement.querySelectorAll('tbody tr')[1]).click();
    await vi.waitFor(() => expect(api.revocar).toHaveBeenCalledWith(ajena.id, false));
    expect(confirmacion.confirmar.mock.calls[0][0].titulo).toBe('¿Cerrar esta sesión?');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('1 sesiones');
    });
    expect(auth.cerrarSesion).not.toHaveBeenCalled();
  });

  it('la propia avisa de forma distinta, se confirma expresamente y sale de la cuenta', async () => {
    const { fixture, api, auth, confirmacion } = montar();
    await cargada(fixture);
    boton(fixture.nativeElement.querySelectorAll('tbody tr')[0]).click();
    await vi.waitFor(() => expect(api.revocar).toHaveBeenCalledWith(propia.id, true));
    expect(confirmacion.confirmar.mock.calls[0][0].titulo).toBe('¿Cerrar tu sesión actual?');
    await vi.waitFor(() => expect(auth.cerrarSesion).toHaveBeenCalled());
  });

  it('si no confirma, no cierra nada', async () => {
    const { fixture, api } = montar(false);
    await cargada(fixture);
    boton(fixture.nativeElement.querySelectorAll('tbody tr')[0]).click();
    await fixture.whenStable();
    expect(api.revocar).not.toHaveBeenCalled();
  });
});

describe('formato del estado de la base', () => {
  it('tamaño en la unidad más cómoda y tiempo en línea legible', () => {
    expect(formatearBytes(512)).toBe('512 bytes');
    expect(formatearBytes(2048)).toBe('2 KB');
    expect(formatearBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    const ahora = Date.parse('2026-10-30T10:00:00Z');
    expect(tiempoEnLinea('2026-10-30T09:52:00Z', ahora)).toBe('8 min');
    expect(tiempoEnLinea('2026-10-30T04:48:00Z', ahora)).toBe('5 h 12 min');
    expect(tiempoEnLinea('2026-10-27T06:00:00Z', ahora)).toBe('3 d 4 h');
  });
});
