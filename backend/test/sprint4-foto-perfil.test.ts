import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_foto');
const almacen = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let ana: Cuenta;

/** PNG de 1×1 válido. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

function subir(bytes: Buffer, nombre = 'yo.png', quien: Cuenta | null = ana) {
  const fd = new FormData();
  fd.append('foto', new Blob([new Uint8Array(bytes)]), nombre);
  return srv.pedir('/api/perfil/foto', { metodo: 'PUT', token: quien?.token, crudo: fd });
}

const fotosEnDisco = () => {
  const dir = path.join(almacen.dir, 'fotos');
  return existsSync(dir) ? readdirSync(dir) : [];
};

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ana = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE']);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  almacen.borrar();
});

describe('Sprint 4 · foto de perfil', () => {
  it('exige sesión y una imagen real de hasta 2 MB', async () => {
    assert.equal((await subir(PNG, 'yo.png', null)).status, 401);
    assert.equal((await subir(Buffer.from('<svg onload=alert(1)>'), 'yo.png')).status, 415);
    assert.equal((await subir(Buffer.alloc(2 * 1024 * 1024 + 1, 0xff), 'grande.jpg')).status, 413);
    assert.equal(fotosEnDisco().length, 0);
  });

  it('guarda la foto, la sirve públicamente con su tipo y borra la anterior al reemplazarla', async () => {
    const primera = await subir(PNG);
    assert.equal(primera.status, 200, primera.texto);
    assert.match(primera.json.fotoUrl, /^\/api\/fotos\/[0-9a-f-]{36}\.png$/);
    const servida = await srv.pedir(primera.json.fotoUrl);
    assert.equal(servida.status, 200);
    assert.equal(servida.headers.get('content-type'), 'image/png');

    const segunda = await subir(JPEG, 'yo.jpg');
    assert.equal(segunda.status, 200, segunda.texto);
    assert.match(segunda.json.fotoUrl, /\.jpg$/);
    assert.equal(fotosEnDisco().length, 1, 'la foto anterior se borró');
    assert.equal((await srv.pedir(primera.json.fotoUrl)).status, 404);
  });

  it('quitar la foto deja fotoUrl en null y borra el archivo; nombres inválidos dan 404', async () => {
    const quitada = await srv.pedir('/api/perfil/foto', { metodo: 'DELETE', token: ana.token });
    assert.equal(quitada.status, 200);
    assert.equal(quitada.json.fotoUrl, null);
    assert.equal(fotosEnDisco().length, 0);
    for (const nombre of ['..%2F..%2Fsecreto.png', 'abc.png', 'x.svg']) {
      assert.equal((await srv.pedir(`/api/fotos/${nombre}`)).status, 404, nombre);
    }
  });
});
