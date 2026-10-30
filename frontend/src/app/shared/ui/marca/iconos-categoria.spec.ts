import { describe, expect, it } from 'vitest';
import { ICONOS } from './iconos';
import { LISTA_ICONOS_CATEGORIA } from './iconos-categoria';

/** `pen-tool` → `PenTool`: así se llama cada ícono en `ICONOS`. */
const pascal = (kebab: string) => kebab.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

describe('íconos de categoría', () => {
  it('todos los que admite el backend están registrados en ICONOS (si no, lucide-icon no los dibuja)', () => {
    const faltan = LISTA_ICONOS_CATEGORIA.filter((icono) => !(pascal(icono) in ICONOS));
    expect(faltan).toEqual([]);
  });

  it('el genérico «tags» va primero: es el que recibe una categoría sin ícono elegido', () => {
    expect(LISTA_ICONOS_CATEGORIA[0]).toBe('tags');
  });
});
