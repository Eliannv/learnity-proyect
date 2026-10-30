import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AccesosApi, type AccesoAdmin, type CuentaBloqueada } from '../../accesos.api';
import { AdminAccesos } from './accesos';

const bloqueada: CuentaBloqueada = {
  idUsuario: 5, nombre: 'Ana Pérez', correo: 'ana@learnity.test', intentosFallidos: 5,
  bloqueadoHasta: new Date(Date.now() + 10 * 60_000).toISOString(),
};

const accesos: AccesoAdmin[] = [
  { id: 2, fecha: '2026-10-29T15:00:00.000Z', usuario: { id: 5, nombre: 'Ana Pérez' }, correo: 'ana@learnity.test',
    paso: 'CLAVE', exito: false, motivo: 'CLAVE_INCORRECTA',
    agente: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
  { id: 1, fecha: '2026-10-29T14:00:00.000Z', usuario: null, correo: 'nadie@x.test',
    paso: 'CLAVE', exito: false, motivo: 'CORREO_DESCONOCIDO', agente: null },
];

function montar() {
  const api = {
    listar: vi.fn().mockResolvedValue({ items: accesos, paginacion: { total: 2, pagina: 1, limite: 20, totalPaginas: 1 } }),
    bloqueadas: vi.fn().mockResolvedValue([bloqueada]),
    desbloquear: vi.fn().mockResolvedValue(undefined),
  };
  const toasts = { exito: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: AccesosApi, useValue: api }, { provide: ToastService, useValue: toasts },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(AdminAccesos);
  fixture.detectChanges();
  return { fixture, api, toasts };
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;

async function cargado(fixture: ReturnType<typeof montar>['fixture']) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 accesos');
  });
}

describe('accesos del administrador', () => {
  it('muestra las cuentas bloqueadas y el registro con resultado, motivo y navegador legibles', async () => {
    const { fixture, api } = montar();
    await cargado(fixture);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('5 intentos');
    expect(texto).toContain('Contraseña incorrecta');
    expect(texto).toContain('Correo no registrado');
    expect(texto).toContain('Sin cuenta');
    expect(texto).toContain('Chrome 130 · Windows');
    expect(fixture.nativeElement.querySelectorAll('.resultado.fallo').length).toBe(2);
    expect(api.listar).toHaveBeenCalledWith({ resultado: 'todos', q: undefined, pagina: 1, limite: 20 });
  });

  it('la pestaña «Solo fallidos» pide solo los fallidos desde la primera página', async () => {
    const { fixture, api } = montar();
    await cargado(fixture);
    boton(fixture.nativeElement, 'Solo fallidos').click();
    expect(api.listar).toHaveBeenLastCalledWith({ resultado: 'fallidos', q: undefined, pagina: 1, limite: 20 });
  });

  it('desbloquear quita la cuenta de la lista y lo confirma con un aviso', async () => {
    const { fixture, api, toasts } = montar();
    await cargado(fixture);
    boton(fixture.nativeElement, 'Desbloquear').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Ninguna cuenta está bloqueada');
    });
    expect(api.desbloquear).toHaveBeenCalledWith(5);
    expect(toasts.exito).toHaveBeenCalledWith('Cuenta de Ana Pérez desbloqueada. Ya puede iniciar sesión.');
  });
});
