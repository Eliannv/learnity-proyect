import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  idYoutube,
  reproductorYoutube,
} from './youtube.js';

import {
  datosLeccionSchema,
} from './temario.esquemas.js';

test('Acepta enlaces oficiales de YouTube', () => {
  const id = 'dQw4w9WgXcQ';

  const enlaces = [
    `https://youtu.be/${id}`,
    `https://www.youtube.com/watch?v=${id}`,
    `https://m.youtube.com/shorts/${id}`,
    `https://youtube.com/embed/${id}`,
    `https://youtube.com/live/${id}`,
  ];

  for (const enlace of enlaces) {
    assert.equal(idYoutube(enlace), id);
  }

  assert.equal(
    reproductorYoutube(id),
    `https://www.youtube-nocookie.com/embed/${id}`,
  );
});

test('Rechaza enlaces falsos y HTML', () => {
  const invalidos = [
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://evil.com/embed/dQw4w9WgXcQ',
    '<iframe src="https://youtube.com"></iframe>',
    'https://youtube.com/watch?v=invalid',
  ];

  for (const enlace of invalidos) {
    assert.equal(idYoutube(enlace), null);
  }
});

test('Valida correctamente VIDEO y DOCUMENTO', () => {
  const datos = {
    titulo: 'Primera lección',
    orden: 1,
  };

  assert.equal(
    datosLeccionSchema.safeParse({
      ...datos,
      tipo: 'VIDEO',
      youtubeUrl:
        'https://youtu.be/dQw4w9WgXcQ',
    }).success,
    true,
  );

  assert.equal(
    datosLeccionSchema.safeParse({
      ...datos,
      tipo: 'VIDEO',
      youtubeUrl: 'https://sitio-falso.com/video',
    }).success,
    false,
  );

  assert.equal(
    datosLeccionSchema.safeParse({
      ...datos,
      tipo: 'DOCUMENTO',
    }).success,
    true,
  );
});