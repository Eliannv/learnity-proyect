import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { describe, expect, it } from 'vitest';

import { ICONOS } from '../marca/iconos';
import { TarjetaCurso } from './tarjeta-curso';

function montar(entradas: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }],
  });
  const fixture = TestBed.createComponent(TarjetaCurso);
  fixture.componentRef.setInput('titulo', 'Angular desde cero');
  for (const [clave, valor] of Object.entries(entradas)) fixture.componentRef.setInput(clave, valor);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TarjetaCurso', () => {
  it('sigue la jerarquía de Udemy: título enlazado, docente, valoración y meta, sin el chip de categoría', () => {
    const el = montar({
      categoria: 'Programación web',
      docente: 'Ana Torres',
      calificacion: { promedio: 4.5, total: 12 },
      meta: '95 min · 8 lecciones',
      enlace: '/cursos/7',
    });
    expect(el.querySelector('a.titulo')?.getAttribute('href')).toBe('/cursos/7');
    expect(el.querySelector('.docente')?.textContent).toBe('Ana Torres');
    expect(el.querySelector('.nota')?.textContent?.trim()).toBe('4,5');
    expect(el.querySelector('app-estrellas')?.getAttribute('aria-label')).toBe('4,5 de 5 estrellas');
    expect(el.querySelector('.conteo')?.textContent?.replace(/\s+/g, ' ')).toBe('(12 reseñas)');
    expect(el.querySelector('.meta')?.textContent?.trim()).toBe('95 min · 8 lecciones');
    expect(el.textContent).not.toContain('Programación web');
  });

  it('omite «0 min» de la meta y muestra la insignia «Nuevo»', () => {
    const el = montar({ meta: '0 min · 4 lecciones', nuevo: true });
    expect([...el.querySelectorAll('.meta span')].map((s) => s.textContent?.trim())).toEqual(['4 lecciones', 'Nuevo']);
    expect(el.textContent).not.toContain('0 min');
  });

  it('sin reseñas calla la valoración pero guarda su fila; sin el dato no la dibuja', () => {
    const sinResenas = montar({ calificacion: { promedio: null, total: 0 } }).querySelector('.valoracion');
    expect(sinResenas?.getAttribute('aria-hidden')).toBe('true');
    expect(sinResenas?.textContent?.trim()).toBe('');
    TestBed.resetTestingModule();
    expect(montar({}).querySelector('.valoracion')).toBeNull();
  });
});
