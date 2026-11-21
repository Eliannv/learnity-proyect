import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, pdfMinimo, subirPdf } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Respuesta, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('videos_grupo');
const pdfs = carpetaPdfPropia();
const muestra = readFileSync(new URL('./fixtures/grabacion-h264.mp4', import.meta.url));
const bloque = 1024 * 1024;
const relleno = Buffer.alloc(bloque);
relleno.writeUInt32BE(bloque);
relleno.write('free', 4);
const mp4 = Buffer.concat([muestra, relleno]);
let srv: Servidor,
  f: Fixtures,
  curso: number,
  modulo: number,
  comun: number,
  grupo: number,
  exclusiva: number;
let c: ReturnType<typeof fabricaCursos>, docente: Cuenta, admin: Cuenta, miembro: Cuenta, fuera: Cuenta;
let inscripcion: number, archivo: string, pdfId: number, zipId: number;
const como = (u: Cuenta, metodo: string, ruta: string, cuerpo?: unknown) => c.como(u, metodo, ruta, cuerpo);
const grupos = () => `/api/docente/cursos/${curso}/grupos`;
const aula = () => `/api/mi-aprendizaje/cursos/${curso}`;
const video = () => `/api/lecciones/${exclusiva}/video`;
function estado(r: Respuesta, esperado: number) {
  assert.equal(r.status, esperado, r.texto.slice(0, 900));
  return r.json;
}
const iniciar = (id: string, tamano: number) =>
  como(docente, 'POST', `/api/docente/cursos/${curso}/grabaciones`, { operacion: id, tamano });
const parte = (id: string, n: number, b: Buffer) =>
  srv.pedir(`/api/grabaciones/${id}/partes/${n}`, {
    metodo: 'PUT',
    token: docente.token,
    crudo: new Uint8Array(b),
    headers: { 'content-type': 'application/octet-stream' },
  });
const confirmar = (id: string) => como(docente, 'POST', `/api/grabaciones/${id}/confirmar`);
async function pase(u: Cuenta) {
  const r = await como(u, 'POST', video() + '/sesion');
  estado(r, 204);
  const cookie = r.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/i);
  assert.ok(cookie.includes('Path=' + video()));
  return cookie.split(';')[0]!;
}

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  miembro = await cuentas.crearCuenta(['ESTUDIANTE']);
  fuera = await cuentas.crearCuenta(['ESTUDIANTE']);
  const cat = await f.query(
    'INSERT INTO categoria(nombre,creada_por) VALUES ($1,$2) RETURNING id_categoria',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => cat.rows[0]!.id_categoria as number);
  const base = await c.cursoCompleto(docente);
  curso = base.idCurso;
  modulo = base.idModulo;
  comun = base.idLeccion;
  await c.enviarARevision(docente, curso);
  estado(await como(admin, 'PUT', `/api/admin/cursos/${curso}/revision`, { decision: 'APROBAR' }), 200);
  inscripcion = estado(await como(miembro, 'POST', `/api/cursos/${curso}/inscripcion`), 201).id;
  estado(await como(fuera, 'POST', `/api/cursos/${curso}/inscripcion`), 201);
});
after(async () => {
  await srv?.cerrar();
  try {
    if (f) await limpiarMarca(f, marca);
  } finally {
    await f?.cerrar();
    pdfs.borrar();
  }
});

describe('Grabaciones privadas y grupos de inscritos', () => {
  it('crea el grupo y restringe su gestión al propietario', async () => {
    const d = estado(
      await como(docente, 'POST', grupos(), { nombre: 'Tutoría', miembros: [inscripcion] }),
      201,
    );
    grupo = d.grupos[0].id;
    assert.deepEqual(d.grupos[0].miembros, [inscripcion]);
    assert.equal(d.inscritos.length, 2);
    estado(await como(docente, 'POST', grupos(), { nombre: 'TUTORÍA', miembros: [] }), 409);
    estado(await como(docente, 'POST', grupos(), { nombre: 'Inexistente', miembros: [2147483647] }), 400);
    estado(await como(fuera, 'GET', grupos()), 403);
    const ajeno = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE', 'DOCENTE'], {
      correo: marca + '.ajeno@qa-edge.test',
    });
    estado(await como(ajeno, 'GET', grupos()), 404);
  });
  it('reanuda la carga, valida un MP4 real y permite adjuntar material', async () => {
    archivo = randomUUID();
    assert.equal(estado(await iniciar(archivo, mp4.length), 201).siguiente, 0);
    estado(await confirmar(archivo), 409);
    estado(await parte(archivo, 1, mp4.subarray(bloque)), 409);
    estado(await parte(archivo, 0, mp4.subarray(0, bloque)), 204);
    estado(await parte(archivo, 0, mp4.subarray(0, bloque)), 204);
    assert.equal(estado(await iniciar(archivo, mp4.length), 201).siguiente, 1);
    estado(await parte(archivo, 1, mp4.subarray(bloque)), 204);
    estado(await confirmar(archivo), 200);
    estado(await confirmar(archivo), 200);
    const detalle = estado(
      await como(docente, 'POST', `/api/modulos/${modulo}/lecciones`, {
        titulo: 'Tutoría exclusiva',
        orden: 2,
        tipo: 'VIDEO',
        grabacionId: archivo,
        grupoId: grupo,
      }),
      201,
    );
    exclusiva = detalle.modulos[0].lecciones[1].id;
    const conPdf = estado(await subirPdf(srv, exclusiva, docente.token, await pdfMinimo()), 200);
    pdfId = conPdf.modulos[0].lecciones[1].archivo.id;
    const fd = new FormData();
    fd.append(
      'archivo',
      new Blob([new Uint8Array([80, 75, 5, 6, ...new Array(18).fill(0)])]),
      'practica.zip',
    );
    const conZip = estado(
      await srv.pedir(`/api/lecciones/${exclusiva}/recursos`, {
        metodo: 'POST',
        token: docente.token,
        crudo: fd,
      }),
      201,
    );
    zipId = conZip.modulos[0].lecciones[1].recursos[0].archivoId;
  });
  it('filtra temario, catálogo, adjuntos y progreso según la audiencia', async () => {
    const a = estado(await como(miembro, 'GET', aula()), 200),
      b = estado(await como(fuera, 'GET', aula()), 200);
    assert.equal(a.totalLecciones, 2);
    assert.equal(b.totalLecciones, 1);
    assert.deepEqual(
      b.modulos[0].lecciones.map((l: { id: number }) => l.id),
      [comun],
    );
    assert.equal(a.modulos[0].lecciones[1].recursos[0].archivoId, zipId);
    const publico = await srv.pedir(`/api/cursos/${curso}`);
    estado(publico, 200);
    assert.ok(!publico.texto.includes('Tutoría exclusiva'));
    for (const id of [pdfId, zipId]) {
      estado(await como(miembro, 'GET', `/api/archivos/${id}`), 200);
      estado(await como(fuera, 'GET', `/api/archivos/${id}`), 403);
    }
    estado(await como(fuera, 'PUT', `/api/lecciones/${exclusiva}/progreso`, { completada: true }), 404);
    estado(await como(fuera, 'POST', video() + '/sesion'), 404);
    assert.equal(
      estado(await como(miembro, 'PUT', `/api/lecciones/${comun}/progreso`, { completada: true }), 200)
        .progresoPct,
      50,
    );
    assert.equal(
      estado(await como(fuera, 'PUT', `/api/lecciones/${comun}/progreso`, { completada: true }), 200)
        .progresoPct,
      100,
    );
    estado(await como(miembro, 'PUT', `/api/lecciones/${exclusiva}/progreso`, { segundosVistos: 2 }), 200);
  });
  it('sirve rangos, revoca el acceso y recalcula el avance al cambiar miembros', async () => {
    const cookie = await pase(miembro);
    await pase(docente);
    await pase(admin);
    estado(await srv.pedir(video()), 401);
    const head = await srv.pedir(video(), { metodo: 'HEAD', headers: { cookie } });
    estado(head, 200);
    assert.equal(head.headers.get('content-length'), String(mp4.length));
    const r = await fetch(srv.base + video(), {
      headers: { cookie, range: `bytes=${bloque - 3}-${bloque + 7}` },
    });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), `bytes ${bloque - 3}-${bloque + 7}/${mp4.length}`);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), mp4.subarray(bloque - 3, bloque + 8));
    estado(await srv.pedir(video(), { headers: { cookie, range: `bytes=${mp4.length}-` } }), 416);
    estado(await como(docente, 'DELETE', grupos() + '/' + grupo), 409);
    estado(
      await como(docente, 'PUT', grupos() + '/' + grupo, { nombre: 'Tutoría', miembros: [], revision: 1 }),
      200,
    );
    estado(await srv.pedir(video(), { headers: { cookie, range: 'bytes=0-7' } }), 404);
    estado(await como(miembro, 'GET', `/api/archivos/${zipId}`), 403);
    const sin = estado(await como(miembro, 'GET', aula()), 200);
    assert.equal(sin.inscripcion.estado, 'COMPLETADA');
    assert.equal(sin.inscripcion.ultimaLeccionId, null);
    estado(
      await como(docente, 'PUT', grupos() + '/' + grupo, { nombre: 'Anterior', miembros: [], revision: 1 }),
      409,
    );
    estado(
      await como(docente, 'PUT', grupos() + '/' + grupo, {
        nombre: 'Tutoría',
        miembros: [inscripcion],
        revision: 2,
      }),
      200,
    );
    const con = estado(await como(miembro, 'GET', aula()), 200);
    assert.equal(con.inscripcion.progresoPct, 50);
    assert.equal(con.modulos[0].lecciones[1].progreso.segundosVistos, 2);
  });
  it('rechaza grupos e inscripciones cruzados y suspende las nuevas lecturas', async () => {
    const otro = await c.cursoCompleto(docente);
    await c.enviarARevision(docente, otro.idCurso);
    estado(
      await como(admin, 'PUT', `/api/admin/cursos/${otro.idCurso}/revision`, { decision: 'APROBAR' }),
      200,
    );
    const externa = estado(await como(fuera, 'POST', `/api/cursos/${otro.idCurso}/inscripcion`), 201);
    estado(await como(docente, 'POST', grupos(), { nombre: 'Cruce', miembros: [externa.id] }), 400);
    estado(
      await como(docente, 'POST', `/api/modulos/${otro.idModulo}/lecciones`, {
        titulo: 'Cruce',
        orden: 2,
        tipo: 'VIDEO',
        youtubeUrl: 'M7lc1UVf-VE',
        grupoId: grupo,
      }),
      400,
    );
    const cookie = await pase(miembro);
    estado(
      await como(admin, 'POST', `/api/admin/cursos/${curso}/suspension`, { motivo: 'Prueba de suspensión', confirmo: true }),
      200,
    );
    estado(await srv.pedir(video(), { headers: { cookie, range: 'bytes=0-9' } }), 404);
    estado(await como(admin, 'DELETE', `/api/admin/cursos/${curso}/suspension`), 200);
    await pase(miembro);
  });
  it('mantiene en cero el curso de grupo vacío y conserva la audiencia en una edición anterior al selector', async () => {
    const otro = await c.crearCurso(docente);
    const mod = await c.crearModulo(docente, otro);
    const g = estado(
      await como(docente, 'POST', `/api/docente/cursos/${otro}/grupos`, {
        nombre: 'Por asignar',
        miembros: [],
      }),
      201,
    ).grupos[0];
    const datos = { titulo: 'Solo tutoría', orden: 1, tipo: 'VIDEO', youtubeUrl: 'M7lc1UVf-VE' };
    const l = estado(
      await como(docente, 'POST', `/api/modulos/${mod}/lecciones`, { ...datos, grupoId: g.id }),
      201,
    ).modulos[0].lecciones[0];
    const editado = estado(
      await como(docente, 'PUT', `/api/lecciones/${l.id}`, { ...datos, titulo: 'Nueva tutoría' }),
      200,
    );
    assert.equal(editado.modulos[0].lecciones[0].grupoId, g.id);
    await c.enviarARevision(docente, otro);
    estado(await como(admin, 'PUT', `/api/admin/cursos/${otro}/revision`, { decision: 'APROBAR' }), 200);
    estado(await como(fuera, 'POST', `/api/cursos/${otro}/inscripcion`), 201);
    const detalle = estado(await como(fuera, 'GET', `/api/mi-aprendizaje/cursos/${otro}`), 200);
    assert.equal(detalle.totalLecciones, 0);
    assert.equal(detalle.inscripcion.estado, 'ACTIVA');
    assert.equal(detalle.inscripcion.progresoPct, 0);
    assert.equal(detalle.modulos.flatMap((m: { lecciones: unknown[] }) => m.lecciones).length, 0);
  });
  it('conserva el original si falla un reemplazo y retira sus bytes al cambiar a YouTube', async () => {
    const falso = randomUUID();
    estado(await iniciar(falso, 12), 201);
    estado(await parte(falso, 0, Buffer.alloc(12)), 204);
    estado(await confirmar(falso), 415);
    const ruta = `/api/lecciones/${exclusiva}`,
      campos = { titulo: 'Nueva tutoría', orden: 2, tipo: 'VIDEO', grupoId: grupo };
    const invalida = await como(docente, 'PUT', ruta, { ...campos, grabacionId: falso });
    assert.ok([400, 409].includes(invalida.status), invalida.texto);
    const cookie = await pase(miembro);
    const reemplazo = estado(
      await como(docente, 'PUT', ruta, { ...campos, youtubeUrl: 'https://youtu.be/M7lc1UVf-VE' }),
      200,
    );
    assert.equal(reemplazo.modulos[0].lecciones[1].archivo.id, pdfId);
    estado(await srv.pedir(video(), { headers: { cookie, range: 'bytes=0-0' } }), 404);
    // El mismo identificador inicia una carga vacía al haberse retirado la original.
    const reinicio = estado(await iniciar(archivo, mp4.length), 201);
    assert.equal(reinicio.siguiente, 0);
    assert.equal(reinicio.lista, false);
    const fueraDelGrupo = estado(await como(fuera, 'GET', aula()), 200);
    assert.deepEqual(
      fueraDelGrupo.modulos[0].lecciones.map((l: { id: number }) => l.id),
      [comun],
    );
  });
});
