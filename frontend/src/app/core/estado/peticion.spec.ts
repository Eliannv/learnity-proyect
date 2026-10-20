import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { Peticion } from './peticion';

describe('Peticion', () => {
  it('aplica el resultado y el mensaje de éxito', async () => {
    const peticion = new Peticion();
    let dato = 0;

    await peticion.ejecutar(async () => 7, (valor) => (dato = valor), 'Listo');

    expect(dato).toBe(7);
    expect(peticion.exito()).toBe('Listo');
    expect(peticion.ocupada()).toBe(false);
  });

  it('traduce el error de la API a mensaje y errores por campo', () => {
    const peticion = new Peticion();

    peticion.fallar(
      new HttpErrorResponse({
        status: 400,
        error: {
          error: {
            codigo: 'SOLICITUD_INVALIDA',
            mensaje: 'Datos inválidos.',
            detalles: [{ campo: 'titulo', mensaje: 'Obligatorio' }],
          },
        },
      }),
    );

    expect(peticion.error()).toBe('Datos inválidos.');
    expect(peticion.campo('titulo')).toBe('Obligatorio');
    expect(peticion.requiereRecarga()).toBe(false);
  });

  it('pide recargar en 409 y avisa de la falta de conexión', () => {
    const peticion = new Peticion();

    peticion.fallar(new HttpErrorResponse({ status: 409, error: { error: { mensaje: 'Conflicto' } } }));
    expect(peticion.requiereRecarga()).toBe(true);

    peticion.fallar(new HttpErrorResponse({ status: 0 }));
    expect(peticion.error()).toContain('No se pudo conectar');
  });
});
