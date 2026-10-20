// Recorrido completo por HTTP (REC-01..11): docente crea, sube PDF y envía; administrador aprueba o rechaza;
// el visitante lo ve en el catálogo. Solo se usa SQL para las cuentas, la categoría y la comprobación final.
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, filasYFicheros, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { sinRutasPrivadas } from '../ayudas/contrato.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('car_rec');
const pdfDir = carpetaPdfPropia();

let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let admin: Cuenta;
let categoriaId = 0;
let c: ReturnType<typeof fabricaCursos>;
const cursos: number[] = [];

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  docente = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const r = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
  categoriaId = r.rows[0]!.id;
  c = fabricaCursos(srv, marca, () => categoriaId);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

const catalogo = (id: number) => srv.pedir(`/api/cursos?q=${encodeURIComponent(marca)}&limite=50`).then((r) => (r.json.items as any[]).some((x) => x.id === id));

describe('REC-01..09: crear, subir, enviar, aprobar y ver', () => {
  it('recorrido feliz', async () => {
    const creado = await c.como(docente, 'POST', '/api/cursos', c.datosCurso('recorrido'));
    assert.equal(creado.status, 201);
    assert.equal(creado.json.estado, 'BORRADOR');
    const id = creado.json.id as number;
    cursos.push(id);

    const idModulo = await c.crearModulo(docente, id, 1);
    const idLeccion = await c.crearLeccion(docente, idModulo, 1);

    const sub = await subirPdf(srv, idLeccion, docente.token, await pdfMinimo(3), 'temario.pdf');
    assert.equal(sub.status, 200, sub.texto);
    const archivo = sub.json.modulos[0].lecciones[0].archivo;
    assert.equal(archivo.nombreOriginal, 'temario.pdf');
    assert.deepEqual(sinRutasPrivadas(sub.json), []);

    const enviado = await c.enviarARevision(docente, id);
    assert.equal(enviado.json.estado, 'EN_REVISION');
    assert.equal(await catalogo(id), false, 'en revisión aún no es público');

    const cola = await c.como(admin, 'GET', '/api/admin/cursos');
    assert.ok((cola.json.items as any[]).some((x) => x.id === id));

    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${id}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200);
    assert.equal(aprobado.json.estado, 'PUBLICADO');

    assert.equal(await catalogo(id), true);
    const detalle = await srv.pedir(`/api/cursos/${id}`);
    assert.equal(detalle.status, 200);
    assert.equal(detalle.json.temario[0].lecciones[0].titulo, 'Lección 1');
    assert.deepEqual(sinRutasPrivadas(detalle.json), []);

    const descarga = await fetch(`${srv.base}/api/archivos/${archivo.id}`, { headers: { authorization: `Bearer ${docente.token}` } });
    assert.equal(descarga.status, 200);
    const bytes = Buffer.from(await descarga.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');
  });
});

describe('REC-10: rechazo, corrección y reenvío', () => {
  it('rechazar, el docente lo ve, edita, reenvía y se aprueba', async () => {
    const { idCurso } = await c.cursoCompleto(docente);
    cursos.push(idCurso);
    await c.enviarARevision(docente, idCurso);

    const rechazo = await c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, { decision: 'RECHAZAR', motivo: 'Faltan ejemplos' });
    assert.equal(rechazo.status, 200);

    const lista = await c.como(docente, 'GET', '/api/docente/cursos');
    const item = (lista.json.items as any[]).find((x) => x.id === idCurso);
    assert.equal(item.estado, 'RECHAZADO');
    assert.equal(item.motivoRechazo, 'Faltan ejemplos');

    const edicion = await c.como(docente, 'PUT', `/api/cursos/${idCurso}`, c.datosCurso('corregido', { titulo: `${marca} corregido ${idCurso}` }));
    assert.equal(edicion.status, 200);

    const reenvio = await c.enviarARevision(docente, idCurso);
    assert.equal(reenvio.json.estado, 'EN_REVISION');
    assert.equal(reenvio.json.motivoRechazo, null);

    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.json.estado, 'PUBLICADO');
    assert.equal(await catalogo(idCurso), true);
  });
});

describe('REC-11: invariantes finales', () => {
  it('filas de archivo = ficheros y sin restos de la marca tras limpiar', async () => {
    const { idCurso } = await c.cursoCompleto(docente);
    cursos.push(idCurso);
    const { rows } = await f.query<{ n: string }>('SELECT count(*) AS n FROM curso WHERE id_curso = ANY($1::int[])', [cursos]);
    assert.equal(rows[0]!.n, String(cursos.length));
    const { filas, ficheros } = await filasYFicheros(f, pdfDir.dir, cursos);
    assert.equal(filas, ficheros, 'cada fila de archivo tiene su fichero y viceversa');
    const pendientes = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo_borrado_pendiente');
    assert.equal(pendientes.rows[0]!.n, '0');
  });
});
