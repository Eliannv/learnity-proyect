import { describe, expect, it } from 'vitest';

import { ICONO_CATEGORIA } from './tipos-ui';

describe('tipos-ui', () => {
  it('las categorías habituales del catálogo tienen ícono', () => {
    for (const categoria of ['Programación', 'Diseño', 'Idiomas', 'Negocios', 'Ofimática', 'Marketing']) {
      expect(ICONO_CATEGORIA[categoria]).toBeTruthy();
    }
  });
});
