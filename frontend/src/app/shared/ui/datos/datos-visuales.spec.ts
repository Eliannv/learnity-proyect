import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { BarraProgreso } from './barra-progreso';
import { Estrellas } from './estrellas';

function montar<T>(tipo: Type<T>, entradas: Record<string, unknown>) {
  const fixture = TestBed.createComponent(tipo);
  for (const [clave, valor] of Object.entries(entradas)) fixture.componentRef.setInput(clave, valor);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Estrellas', () => {
  it('es una imagen con nombre accesible y sin el carácter de estrella', () => {
    const el = montar(Estrellas, { valor: 4.5 });
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('4,5 de 5 estrellas');
    expect(el.textContent).not.toContain(String.fromCodePoint(0x2605));
    expect(el.querySelectorAll('svg.relleno path')).toHaveLength(5);
  });

  it('recorta el relleno en la posición real de la estrella (con el aire entre ellas)', () => {
    const recorte = (valor: number) =>
      (montar(Estrellas, { valor }).querySelector('svg.relleno') as SVGElement).style.clipPath;
    expect(recorte(0)).toBe('inset(0 100.00% 0 0)');
    expect(recorte(5)).toBe('inset(0 0.00% 0 0)');
    // 4,5: cuatro estrellas enteras (4 × 26) y media (12) de 128 unidades.
    expect(recorte(4.5)).toBe('inset(0 9.38% 0 0)');
  });
});

describe('BarraProgreso', () => {
  it('avanza con transform y acota el valor entre 0 y 100', () => {
    const relleno = (valor: number) => (montar(BarraProgreso, { valor }).querySelector('span') as HTMLElement).style.transform;
    expect(relleno(40)).toBe('scaleX(0.4)');
    expect(relleno(140)).toBe('scaleX(1)');
    expect(relleno(-5)).toBe('scaleX(0)');
  });
});
