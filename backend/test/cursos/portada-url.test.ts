import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { esPortadaValida } from '../../src/modules/cursos/cursos.esquemas.js';

describe('esPortadaValida · URL de la portada del curso', () => {
  it('acepta https/http externos, imágenes estáticas /img/… y portadas subidas /api/fotos/<uuid>', () => {
    for (const valida of [
      'https://cdn.ejemplo.com/portada.jpg',
      'http://ejemplo.com/a.png',
      '/img/portada.jpg',
      '/img/cursos/portada-1.webp',
      '/api/fotos/0b5c2f6e-1d2a-4c3b-9e8f-7a6b5c4d3e2f.jpg',
    ]) {
      assert.equal(esPortadaValida(valida), true, valida);
    }
  });

  it('rechaza esquemas peligrosos, rutas ajenas, travesía de directorios y credenciales', () => {
    for (const mala of [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'file:///etc/passwd',
      'ftp://ejemplo.com/a.jpg',
      '//evil.com/a.jpg',
      '/img/../api/admin/usuarios',
      '/img/..',
      '/api/admin/usuarios',
      '/api/fotos/../../secreto.png',
      '/api/fotos/no-es-uuid.jpg',
      '/img/a.jpg?x=1',
      '/img/a b.jpg',
      '/img\\a.jpg',
      'https://usuario:clave@ejemplo.com/a.jpg',
      `https://ejemplo.com/${'a'.repeat(250)}.jpg`,
      '',
    ]) {
      assert.equal(esPortadaValida(mala), false, mala);
    }
  });
});
