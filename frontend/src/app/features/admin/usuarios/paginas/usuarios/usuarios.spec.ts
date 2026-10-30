import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ConfirmacionService } from '../../../../../shared/ui/retroalimentacion/confirmacion.service';
import { ToastService } from '../../../../../shared/ui/retroalimentacion/toast.service';
import { AdminUsuariosApi, type DetalleUsuarioAdmin, type UsuarioAdmin } from '../../usuarios.api';
import { AdminUsuarios } from './usuarios';

const ana: UsuarioAdmin = {
  id: 5, idPersona: 50, nombre: 'Ana Pérez', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@learnity.test',
  ciudad: null, fotoUrl: null, roles: ['ESTUDIANTE'], activo: true, estado: 'ACTIVO',
  creadoEn: '2026-09-01T10:00:00.000Z', ultimoAcceso: null, bloqueadoHasta: new Date(Date.now() + 600_000).toISOString(),
};

const detalle: DetalleUsuarioAdmin = {
  ...ana, intentosFallidos: 5, especialidad: null, invitacionPendienteHasta: null,
  sesiones: [{ id: '0c1e3a8e-0000-4000-8000-000000000001', iniciadaEn: '2026-10-29T10:00:00.000Z',
    renovadaEn: '2026-10-29T12:00:00.000Z', expiraEn: '2026-11-05T10:00:00.000Z',
    agente: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0' }],
  inscripciones: [{ curso: { id: 7, titulo: 'Álgebra' }, estado: 'ACTIVA', progresoPct: 40,
    inscritoEn: '2026-10-01T10:00:00.000Z', ultimaActividadEn: '2026-10-28T10:00:00.000Z' }],
  cursosCreados: [],
};

function montar(opciones: { errorAlta?: unknown } = {}) {
  const api = {
    listar: vi.fn().mockResolvedValue({
      items: [ana], paginacion: { total: 1, pagina: 1, limite: 20, totalPaginas: 1 },
      conteos: { total: 1, estudiantes: 1, docentes: 0, administradores: 0 },
    }),
    crear: opciones.errorAlta ? vi.fn().mockRejectedValue(opciones.errorAlta)
      : vi.fn().mockResolvedValue({ ...ana, id: 9, nombre: 'Rosa Vera', correo: 'rosa@learnity.test' }),
    detalle: vi.fn().mockResolvedValue(detalle),
    cerrarSesiones: vi.fn().mockResolvedValue(1),
    desbloquear: vi.fn().mockResolvedValue(undefined),
    cambiarEstado: vi.fn(), cambiarRoles: vi.fn(),
  };
  const toasts = { exito: vi.fn(), error: vi.fn() };
  const confirmar = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: AdminUsuariosApi, useValue: api }, { provide: ToastService, useValue: toasts },
      { provide: ConfirmacionService, useValue: { confirmar } },
      { provide: AuthService, useValue: { usuario: () => ({ idPersona: 1 }) } },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(AdminUsuarios);
  fixture.detectChanges();
  return { fixture, api, toasts, confirmar, el: fixture.nativeElement as HTMLElement };
}

const boton = (el: HTMLElement, texto: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim().includes(texto)) as HTMLButtonElement;

async function esperar(fixture: ReturnType<typeof montar>['fixture'], texto: string) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(texto);
  });
}

function escribir(el: HTMLElement, id: string, valor: string) {
  const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

describe('usuarios del administrador', () => {
  it('marca la cuenta bloqueada y la desbloquea desde la fila', async () => {
    const { fixture, api, toasts, el } = montar();
    await esperar(fixture, '1 cuentas');
    expect(el.querySelector('.chip-bloqueada')?.textContent).toContain('Bloqueada');
    boton(el, 'Desbloquear').click();
    await vi.waitFor(() => expect(api.desbloquear).toHaveBeenCalledWith(5));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('.chip-bloqueada')).toBeNull();
    });
    expect(toasts.exito).toHaveBeenCalledWith('Cuenta de Ana Pérez desbloqueada. Ya puede iniciar sesión.');
  });

  it('crea una cuenta por invitación y avisa a quién se envió', async () => {
    const { fixture, api, toasts, el } = montar();
    await esperar(fixture, '1 cuentas');
    boton(el, 'Crear usuario').click();
    fixture.detectChanges();
    escribir(el, 'alta-nombres', 'Rosa');
    escribir(el, 'alta-apellidos', 'Vera');
    escribir(el, 'alta-correo', 'rosa@learnity.test');
    fixture.detectChanges();
    boton(el, 'Crear y enviar invitación').click();
    await vi.waitFor(() => expect(api.crear).toHaveBeenCalledWith(
      { nombres: 'Rosa', apellidos: 'Vera', correo: 'rosa@learnity.test', roles: [] }));
    await vi.waitFor(() => expect(toasts.exito).toHaveBeenCalledWith(
      'Cuenta de Rosa Vera creada. Le enviamos la invitación a rosa@learnity.test; vence en 72 horas.'));
    fixture.detectChanges();
    expect(el.querySelector('app-alta-usuario')).toBeNull();
  });

  it('si el correo ya existe, el modal sigue abierto con el mensaje de la API', async () => {
    const errorAlta = new HttpErrorResponse({ status: 409,
      error: { error: { codigo: 'CORREO_EN_USO', mensaje: 'Ya existe una cuenta con ese correo.' } } });
    const { fixture, el } = montar({ errorAlta });
    await esperar(fixture, '1 cuentas');
    boton(el, 'Crear usuario').click();
    fixture.detectChanges();
    escribir(el, 'alta-nombres', 'Ana');
    escribir(el, 'alta-apellidos', 'Pérez');
    escribir(el, 'alta-correo', 'ana@learnity.test');
    fixture.detectChanges();
    boton(el, 'Crear y enviar invitación').click();
    await esperar(fixture, 'Ya existe una cuenta con ese correo.');
    expect(el.querySelector('app-alta-usuario')).not.toBeNull();
  });

  it('abre la ficha con sesiones e inscripciones y cierra las sesiones tras confirmar', async () => {
    const { fixture, api, toasts, confirmar, el } = montar();
    await esperar(fixture, '1 cuentas');
    el.querySelector<HTMLButtonElement>('.enlace-nombre')!.click();
    await esperar(fixture, 'Sesiones abiertas (1)');
    expect(api.detalle).toHaveBeenCalledWith(5);
    const ficha = el.querySelector('app-ficha-usuario')!.textContent!;
    expect(ficha).toContain('Firefox 131 · Linux');
    expect(ficha).toContain('Álgebra');
    expect(ficha).toContain('40 %');
    expect(ficha).toContain('Nunca ha entrado');

    boton(el, 'Cerrar todas las sesiones').click();
    await vi.waitFor(() => expect(api.cerrarSesiones).toHaveBeenCalledWith(5));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'Cerrar sesiones', peligro: true }));
    await vi.waitFor(() => expect(toasts.exito).toHaveBeenCalledWith('Se cerró 1 sesión de Ana Pérez.'));
    expect(api.detalle).toHaveBeenCalledTimes(2);
  });
});
