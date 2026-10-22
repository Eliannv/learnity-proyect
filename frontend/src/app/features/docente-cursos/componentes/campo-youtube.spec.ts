import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CampoYoutube } from './campo-youtube';

describe('campo YouTube del editor', () => {
  function crear() {
    const f = TestBed.createComponent(CampoYoutube);
    f.componentRef.setInput('id', 'video-leccion-1');
    f.detectChanges();
    return f;
  }
  it('asocia etiqueta, ayuda y errores con el campo', () => {
    const f = crear();
    expect(f.nativeElement.querySelector('label').htmlFor).toBe('video-leccion-1');
    expect(f.componentInstance.validar()).toBe(false);
    f.detectChanges();
    expect(f.nativeElement.querySelector('input').getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('Escribe el enlace');
  });
  it('emite la entrada y acepta enlaces sin crear iframes desde el texto', () => {
    const f = crear();
    const cambios = vi.fn();
    f.componentInstance.enlace.subscribe(cambios);
    const entrada = f.nativeElement.querySelector('input') as HTMLInputElement;
    entrada.value = 'https://youtu.be/M7lc1UVf-VE';
    entrada.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(f.componentInstance.validar()).toBe(true);
    expect(cambios).toHaveBeenCalledWith(entrada.value);
    expect(f.nativeElement.querySelector('iframe')).toBeNull();
  });
  it('rechaza iframe y muestra los mensajes como texto', () => {
    const f = crear();
    f.componentRef.setInput('enlace', '<iframe src="https://falso.example"></iframe>');
    expect(f.componentInstance.validar()).toBe(false);
    f.componentRef.setInput('errorServidor', '<b>Enlace rechazado</b>');
    f.detectChanges();
    expect(f.nativeElement.querySelector('b')).toBeNull();
    expect(f.nativeElement.textContent).toContain('<b>Enlace rechazado</b>');
  });
  it('conserva el estado bloqueado durante una petición del editor', () => {
    const f = crear();
    f.componentRef.setInput('bloqueado', true);
    f.detectChanges();
    expect(f.nativeElement.querySelector('input').disabled).toBe(true);
  });
});
