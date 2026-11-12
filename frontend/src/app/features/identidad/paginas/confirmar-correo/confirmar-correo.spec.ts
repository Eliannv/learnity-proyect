import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerfilService } from '../../../../core/auth/perfil.service';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import { ConfirmarCorreo, leerToken } from './confirmar-correo';

const TOKEN = 'a'.repeat(43);

function montar(fragmento: string | null, confirmar: ReturnType<typeof vi.fn>, conSesion = false) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { fragment: fragmento } } },
      { provide: PerfilService, useValue: { confirmarCambioCorreo: confirmar } },
      { provide: AuthService, useValue: { autenticado: signal(conSesion), rutaPerfil: signal('/admin/perfil') } },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(ConfirmarCorreo);
  fixture.detectChanges();
  return fixture;
}

describe('confirmar el nuevo correo', () => {
  it('lee solo tokens opacos de 43 caracteres del fragmento', () => {
    expect(leerToken(`token=${TOKEN}`)).toBe(TOKEN);
    expect(leerToken('token=corto')).toBeNull();
    expect(leerToken(null)).toBeNull();
  });

  it('con sesión iniciada confirma al abrir, muestra el éxito y lleva a su perfil', async () => {
    const confirmar = vi.fn().mockResolvedValue({
      mensaje: 'Tu correo electrónico ha sido confirmado y actualizado correctamente.', correo: 'nuevo@ejemplo.com',
    });
    const fixture = montar(`token=${TOKEN}`, confirmar, true);
    expect(confirmar).toHaveBeenCalledWith(TOKEN);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.aviso.exito')?.textContent).toContain('nuevo@ejemplo.com');
    });
    const enlace = fixture.nativeElement.querySelector('a.btn-primario') as HTMLAnchorElement;
    expect(enlace.textContent).toContain('Ir a mi perfil');
    expect(enlace.getAttribute('href')).toBe('/admin/perfil');
  });

  it('sin sesión también confirma y ofrece iniciar sesión con el nuevo correo', async () => {
    const confirmar = vi.fn().mockResolvedValue({ mensaje: 'Listo.', correo: 'nuevo@ejemplo.com' });
    const fixture = montar(`token=${TOKEN}`, confirmar, false);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
    });
  });

  it('muestra el error del servidor, por ejemplo si el correo ya es de otra cuenta', async () => {
    const confirmar = vi.fn().mockRejectedValue(new HttpErrorResponse({
      status: 409,
      error: { error: { codigo: 'CORREO_DUPLICADO', mensaje: 'Este correo electrónico ya está asociado a otra cuenta.' } },
    }));
    const fixture = montar(`token=${TOKEN}`, confirmar);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
        .toContain('Este correo electrónico ya está asociado a otra cuenta.');
    });
  });

  it('sin token válido no llama a la API y explica qué hacer', () => {
    const confirmar = vi.fn();
    const fixture = montar(null, confirmar);
    expect(confirmar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Este enlace no es válido');
  });
});
