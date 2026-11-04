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
let cuentas: ReturnType<typeof fabricaCuentas>;

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
  cuentas = fabricaCuentas(f, srv, marca);
  ana = await cuentas.crearCuenta(['ESTUDIANTE']);
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

  it('acepta un enlace https:// externo, rechaza los demás y borra la foto subida que reemplaza', async () => {
    const ponerUrl = (fotoUrl: unknown, quien: Cuenta = ana) =>
      srv.pedir('/api/perfil/foto', { metodo: 'PUT', token: quien.token, cuerpo: { fotoUrl } });

    for (const mala of [
      'javascript:alert(1)',
      'http://ejemplo.com/a.jpg',
      'https://usuario:clave@ejemplo.com/a.jpg',
      '/img/a.jpg',
      '/api/fotos/00000000-0000-4000-8000-000000000000.jpg',
      `https://ejemplo.com/${'a'.repeat(250)}.jpg`,
      42,
    ]) {
      const r = await ponerUrl(mala);
      assert.equal(r.status, 400, String(mala));
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    }

    const subida = await subir(PNG);
    assert.equal(subida.status, 200, subida.texto);
    const ok = await ponerUrl('  https://ejemplo.com/avatar-ana.jpg  ');
    assert.equal(ok.status, 200, ok.texto);
    assert.equal(ok.json.fotoUrl, 'https://ejemplo.com/avatar-ana.jpg');
    assert.equal(fotosEnDisco().length, 0, 'la foto subida anterior se borró');
    assert.equal((await srv.pedir(subida.json.fotoUrl)).status, 404);
  });

  it('nadie puede apuntar su perfil a la foto de otra persona para borrarla después', async () => {
    const bea = await cuentas.crearCuenta(['ESTUDIANTE']);
    const deBea = await subir(PNG, 'bea.png', bea);
    assert.equal(deBea.status, 200, deBea.texto);

    const robo = await srv.pedir('/api/perfil/foto', { metodo: 'PUT', token: ana.token, cuerpo: { fotoUrl: deBea.json.fotoUrl } });
    assert.equal(robo.status, 400);
    assert.equal((await srv.pedir('/api/perfil/foto', { metodo: 'DELETE', token: ana.token })).status, 200);
    assert.equal((await srv.pedir(deBea.json.fotoUrl)).status, 200, 'la foto de Bea sigue disponible');
  });
});

describe('Sprint 4 · portada del curso', () => {
  function subirPortada(bytes: Buffer, quien: Cuenta | null) {
    const fd = new FormData();
    fd.append('foto', new Blob([new Uint8Array(bytes)]), 'portada.jpg');
    return srv.pedir('/api/cursos/portada', { metodo: 'POST', token: quien?.token, crudo: fd });
  }

  it('solo un docente sube una imagen real y recibe su URL pública', async () => {
    const docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
    assert.equal((await subirPortada(JPEG, null)).status, 401);
    assert.equal((await subirPortada(JPEG, ana)).status, 403);
    assert.equal((await subirPortada(Buffer.from('<svg/>'), docente)).status, 415);

    const r = await subirPortada(JPEG, docente);
    assert.equal(r.status, 201, r.texto);
    assert.match(r.json.portadaUrl, /^\/api\/fotos\/[0-9a-f-]{36}\.jpg$/);
    const servida = await srv.pedir(r.json.portadaUrl);
    assert.equal(servida.status, 200);
    assert.equal(servida.headers.get('content-type'), 'image/jpeg');
    // La portada no pertenece a ninguna cuenta: se borra aquí para no dejarla en archivo_binario.
    // Import dinámico: uno estático cargaría la configuración antes de que carpetaPdfPropia fije PDF_DIR.
    const { almacenFotos } = await import('../src/shared/archivos/fotos.js');
    await almacenFotos.eliminarPorUrl(r.json.portadaUrl);
  });
});
