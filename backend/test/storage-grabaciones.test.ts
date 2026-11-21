import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import './ayudas/guardia-bd.js';

it('el adaptador de Storage verifica el bucket privado, sube, lee y retira los bloques por la API autenticada', async (t) => {
  const origen = 'https://storage-qa.example',
    bucket = 'grabaciones-prueba',
    clave = randomUUID();
  process.env.VIDEO_SUPABASE_URL = origen;
  process.env.VIDEO_SUPABASE_CLAVE = 'sb_secret_prueba_local';
  const { storagePrivado } = await import('../src/modules/contenido/grabaciones/grabaciones.storage.js');
  const datos = Buffer.from('bloque de prueba');
  let publico = true,
    retirado = false;
  const objetos = new Map<string, Buffer>();
  t.mock.method(globalThis, 'fetch', async (url: string, opciones: RequestInit) => {
    assert.ok(url.startsWith(origen + '/storage/v1/'));
    assert.equal(new Headers(opciones.headers).get('apikey'), 'sb_secret_prueba_local');
    assert.equal(opciones.redirect, 'error');
    const ruta = new URL(url).pathname.replace('/storage/v1/', '');
    if (ruta === 'bucket/' + bucket) return Response.json({ id: bucket, public: publico });
    const objeto = `object/${bucket}/grabaciones/${clave}/0.bin`;
    if (opciones.method === 'DELETE') {
      assert.equal(ruta, 'object/' + bucket);
      assert.deepEqual(JSON.parse(String(opciones.body)).prefixes, [`grabaciones/${clave}/0.bin`]);
      objetos.delete(objeto);
      retirado = true;
      return Response.json([]);
    }
    assert.equal(ruta, objeto);
    if (opciones.method === 'POST') {
      objetos.set(ruta, Buffer.from(opciones.body as Uint8Array));
      return Response.json({ Key: ruta });
    }
    const bytes = objetos.get(ruta);
    return bytes ? new Response(new Uint8Array(bytes)) : new Response(null, { status: 404 });
  });
  await assert.rejects(storagePrivado.comprobarBucket(bucket), /bucket privado/);
  publico = false;
  await storagePrivado.comprobarBucket(bucket);
  await storagePrivado.guardar(bucket, clave, 0, datos);
  assert.deepEqual(await storagePrivado.leer(bucket, clave, 0, datos.length), datos);
  await assert.rejects(storagePrivado.leer(bucket, clave, 0, datos.length - 1), /almacén/);
  await storagePrivado.retirar(bucket, clave, 1);
  assert.ok(retirado);
  await assert.rejects(storagePrivado.leer(bucket, clave, 0, datos.length), /almacén/);
});
