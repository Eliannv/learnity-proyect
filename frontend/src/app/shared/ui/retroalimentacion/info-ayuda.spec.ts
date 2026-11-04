import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { describe, expect, it } from 'vitest';
import { ICONOS } from '../marca/iconos';
import { InfoAyuda } from './info-ayuda';

@Component({
  imports: [InfoAyuda],
  template: `
    <app-info-ayuda etiqueta="Ayuda sobre la portada" titulo="Portada">
      <li>Imagen en <strong>16:9</strong>.</li>
    </app-info-ayuda>
    <button type="button" id="fuera">Otro</button>
  `,
})
class Anfitrion {}

describe('ícono de información (app-info-ayuda)', () => {
  function crear() {
    TestBed.configureTestingModule({
      providers: [{ provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }],
    });
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const boton = el.querySelector<HTMLButtonElement>('.boton-info')!;
    const panel = el.querySelector<HTMLElement>('.panel-info')!;
    return { f, el, boton, panel };
  }

  it('empieza oculta y el botón tiene nombre accesible y aria-controls hacia el panel', () => {
    const { boton, panel } = crear();
    expect(boton.getAttribute('aria-label')).toBe('Ayuda sobre la portada');
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.hidden).toBe(true);
  });

  it('al pulsar muestra el título y el contenido proyectado; al volver a pulsar se oculta', () => {
    const { f, boton, panel } = crear();
    boton.click();
    f.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Portada');
    expect(panel.querySelector('li strong')?.textContent).toBe('16:9');
    boton.click();
    f.detectChanges();
    expect(panel.hidden).toBe(true);
  });

  it('Escape la cierra y devuelve el foco al botón; un clic fuera también la cierra', () => {
    const { f, el, boton, panel } = crear();
    boton.click();
    f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(boton);

    boton.click();
    f.detectChanges();
    panel.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    f.detectChanges();
    expect(panel.hidden).toBe(false);
    el.querySelector('#fuera')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    f.detectChanges();
    expect(panel.hidden).toBe(true);
  });
});
