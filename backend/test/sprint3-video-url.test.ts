import assert from 'node:assert/strict';
import { it } from 'node:test';
import { extraerYoutubeVideoId } from '../src/modules/cursos/temario/temario.esquemas.js';

const id = 'dQw4w9WgXcQ';

it('normaliza únicamente IDs y hosts YouTube exactos', () => {
  assert.equal(extraerYoutubeVideoId(id), id);
  assert.equal(extraerYoutubeVideoId(`https://youtu.be/${id}?t=10`), id);
  assert.equal(extraerYoutubeVideoId(`https://www.youtube.com/watch?v=${id}&t=10`), id);
  assert.equal(extraerYoutubeVideoId(`https://www.youtube.com/shorts/${id}`), id);
  for (const entrada of [
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://youtube.com@evil.test/watch?v=${id}`,
    `http://youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&v=${id}`,
    'javascript:alert(1)',
  ]) assert.equal(extraerYoutubeVideoId(entrada), null, entrada);
});
