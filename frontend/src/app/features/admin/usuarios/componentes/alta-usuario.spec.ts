import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../../../shared/ui/marca/iconos';
import type { NuevoUsuarioAdmin } from '../usuarios.api';
import { AltaUsuario } from './alta-usuario';

function montar() {
  TestBed.configureTestingModule({ providers: [{ provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }] });
  const fixture = TestBed.createComponent(AltaUsuario);
  const enviados: NuevoUsuarioAdmin[] = [];
  fixture.componentInstance.guardar.subscribe((d) => enviados.push(d));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const escribir = (id: string, valor: string) => {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const marcar = (texto: string) => {
    const label = [...el.querySelectorAll('label.opcion')].find((l) => l.textContent?.includes(texto))!;
    const input = label.querySelector('input')!;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const enviar = () => {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  };
  return { fixture, el, enviados, escribir, marcar, enviar };
}

describe('alta de usuario', () => {
  it('no envía con campos vacíos y muestra el error junto a cada campo', () => {
    const { el, enviados, enviar } = montar();
    enviar();
    expect(enviados).toEqual([]);
    expect(el.querySelector('#alta-nombres-error')?.textContent).toContain('Escribe los nombres.');
    expect(el.querySelector('#alta-correo-error')?.textContent).toContain('Escribe un correo válido.');
    expect(el.querySelector('#alta-nombres')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('con Docente pide la especialidad y la envía junto con los roles', () => {
    const { el, enviados, escribir, marcar, enviar } = montar();
    escribir('alta-nombres', ' Rosa ');
    escribir('alta-apellidos', 'Vera');
    escribir('alta-correo', 'rosa@learnity.test');
    marcar('Docente');
    enviar();
    expect(enviados).toEqual([]);
    expect(el.querySelector('#alta-especialidad-error')?.textContent).toContain('Escribe la especialidad');

    escribir('alta-especialidad', 'Matemáticas');
    marcar('Administrador');
    enviar();
    expect(enviados).toEqual([{
      nombres: 'Rosa', apellidos: 'Vera', correo: 'rosa@learnity.test', roles: ['DOCENTE', 'ADMIN'], especialidad: 'Matemáticas',
    }]);
  });

  it('muestra los errores por campo que devuelve la API', () => {
    const { fixture, el } = montar();
    fixture.componentRef.setInput('errores', { correo: 'Ya existe una cuenta con ese correo.' });
    fixture.detectChanges();
    expect(el.querySelector('#alta-correo-error')?.textContent).toContain('Ya existe una cuenta con ese correo.');
  });
});
