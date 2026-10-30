import { filasDiff, textoValor } from './filas-diff';

describe('filas del diff de auditoría', () => {
  it('en un UPDATE marca solo las columnas que cambiaron', () => {
    const filas = filasDiff({
      operacion: 'UPDATE',
      antes: { id_categoria: 4, nombre: 'Diseño', activa: true },
      despues: { id_categoria: 4, nombre: 'Diseño gráfico', activa: true },
      columnasCambiadas: ['nombre'],
    });
    expect(filas).toEqual([
      { columna: 'id_categoria', antes: '4', despues: '4', cambio: false, sinValor: false },
      { columna: 'nombre', antes: 'Diseño', despues: 'Diseño gráfico', cambio: true, sinValor: false },
      { columna: 'activa', antes: 'true', despues: 'true', cambio: false, sinValor: false },
    ]);
  });

  it('en INSERT todo es nuevo y en DELETE todo se borra', () => {
    expect(filasDiff({ operacion: 'INSERT', antes: null, despues: { id: 1, nota: null }, columnasCambiadas: null }))
      .toEqual([
        { columna: 'id', antes: null, despues: '1', cambio: true, sinValor: false },
        { columna: 'nota', antes: null, despues: 'null', cambio: true, sinValor: false },
      ]);
    expect(filasDiff({ operacion: 'DELETE', antes: { id: 1 }, despues: null, columnasCambiadas: null }))
      .toEqual([{ columna: 'id', antes: '1', despues: null, cambio: true, sinValor: false }]);
  });

  it('una columna que cambió sin valor registrado (contrasena_hash) se marca como tal', () => {
    const filas = filasDiff({
      operacion: 'UPDATE', antes: { id_usuario: 3 }, despues: { id_usuario: 3 }, columnasCambiadas: ['contrasena_hash'],
    });
    expect(filas.at(-1)).toEqual({ columna: 'contrasena_hash', antes: null, despues: null, cambio: true, sinValor: true });
  });

  it('muestra los objetos como JSON y null como texto', () => {
    expect(textoValor({ a: [1, 2] })).toBe('{"a":[1,2]}');
    expect(textoValor(null)).toBe('null');
    expect(textoValor(false)).toBe('false');
  });
});
