import { describe, expect, it } from 'vitest';

import * as demo from '../../data/datos-demo';
import { ICONO_CATEGORIA } from './tipos-ui';

describe('tipos-ui', () => {
  it('datos-demo reexporta el mismo mapa de íconos', () => {
    expect(demo.ICONO_CATEGORIA).toBe(ICONO_CATEGORIA);
  });

  it('cada categoría de demostración tiene ícono', () => {
    for (const categoria of demo.CATEGORIAS) {
      expect(ICONO_CATEGORIA[categoria]).toBeTruthy();
    }
  });
});
