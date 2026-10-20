import { HttpErrorResponse } from '@angular/common/http';
import { convertirErrorApi, erroresPorCampo, mensajeDeError } from './error-api';

describe('error-api', () => {
  it('muestra el primer detalle de validación y distribuye los errores por campo', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        error: {
          codigo: 'SOLICITUD_INVALIDA',
          mensaje: 'Revisa los datos enviados.',
          detalles: [
            { campo: 'correo', mensaje: 'El correo no es válido.' },
            { campo: 'nombres', mensaje: 'Es obligatorio.' },
            { campo: 'ignorar', mensaje: 123 },
          ],
        },
      },
    });

    expect(convertirErrorApi(error)?.estadoHttp).toBe(400);
    expect(mensajeDeError(error, 'El registro')).toBe('El correo no es válido.');
    expect(erroresPorCampo(error)).toEqual({
      correo: 'El correo no es válido.',
      nombres: 'Es obligatorio.',
    });
  });

  it('no confía en cuerpos mal formados y conserva el mensaje de conexión', () => {
    const malFormado = new HttpErrorResponse({ status: 500, error: { error: { detalles: 'no es una lista' } } });
    const sinConexion = new HttpErrorResponse({ status: 0 });

    expect(erroresPorCampo(malFormado)).toEqual({});
    expect(mensajeDeError(malFormado, 'La carga')).toBe('La carga no se pudo completar. Inténtalo de nuevo.');
    expect(mensajeDeError(sinConexion, 'La carga')).toContain('No se pudo conectar con el servidor.');
  });
});
