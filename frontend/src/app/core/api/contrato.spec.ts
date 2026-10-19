import { describe, expect, expectTypeOf, it } from 'vitest';

import type { components } from './generado/esquema';
import type {
  CursoDetalle,
  DecisionRevision,
  EstadoCurso,
} from './contrato';

describe('contrato de la API', () => {
  it('los alias son los esquemas generados', () => {
    expectTypeOf<CursoDetalle>().toEqualTypeOf<components['schemas']['CursoDetalle']>();
    expectTypeOf<EstadoCurso>().toEqualTypeOf<CursoDetalle['estado']>();
  });

  it('la decisión de revisión exige motivo solo al rechazar', () => {
    const aprobar: DecisionRevision = { decision: 'APROBAR' };
    const rechazar: DecisionRevision = { decision: 'RECHAZAR', motivo: 'Falta contenido' };

    expect(aprobar.decision).toBe('APROBAR');
    expect(rechazar.decision).toBe('RECHAZAR');
  });
});
