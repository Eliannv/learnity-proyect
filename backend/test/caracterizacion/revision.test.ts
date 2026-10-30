// Caracterización de la revisión de cursos por el administrador (CAR-REV-01..09, paquetes AUT e ID).
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, ficheros } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { errorIdInvalido, forma, ID_DEMASIADO_GRANDE, ID_NO_DECIMAL, IDS_NO_DECIMALES, sinRutasPrivadas } from '../ayudas/contrato.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('car_rev');
const pdfDir = carpetaPdfPropia();

let f: Fixtures;
let srv: Servidor;
let docA: Cuenta;
let est: Cuenta;
let admin: Cuenta;
let categoriaId = 0;
let c: ReturnType<typeof fabricaCursos>;

const admin$ = (metodo: string, ruta: string, cuerpo?: unknown) => c.como(admin, metodo, ruta, cuerpo);

async function enRevision(): Promise<number> {
  const { idCurso } = await c.cursoCompleto(docA);
  await c.enviarARevision(docA, idCurso);
  return idCurso;
}

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  docA = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  est = await fab.crearCuenta(['ESTUDIANTE']);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const r = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, docA.idPersona]);
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

describe('AUT e ID en las rutas de revisión', () => {
  const rutas: Array<[string, string, unknown?]> = [
    ['GET', '/api/admin/cursos'], ['GET', '/api/admin/cursos/1'], ['PUT', '/api/admin/cursos/1/revision', { decision: 'APROBAR' }],
  ];
  for (const [metodo, ruta, cuerpo] of rutas) {
    it(`${metodo} ${ruta}`, async () => {
      const sin = await srv.pedir(ruta, { metodo, cuerpo });
      assert.equal(sin.status, 401);
      assert.equal(sin.json.error.codigo, 'NO_AUTENTICADO');
      for (const quien of [docA, est]) {
        const r = await c.como(quien, metodo, ruta, cuerpo);
        assert.equal(r.status, 403, quien.roles.join());
        assert.equal(r.json.error.codigo, 'SIN_PERMISO');
      }
    });
  }
  it('ID-1 a ID-4 (ADR-011, 11.11) en las rutas admin con :id', async () => {
    const rutas: Array<[string, string, unknown?]> = [
      ['GET', '/api/admin/cursos/:id'], ['PUT', '/api/admin/cursos/:id/revision', { decision: 'APROBAR' }],
    ];
    for (const [metodo, plantilla, cuerpo] of rutas) {
      for (const v of IDS_NO_DECIMALES) {
        const x = await admin$(metodo, plantilla.replace(':id', v), cuerpo);
        assert.equal(x.status, 400, `${metodo} ${plantilla} ${v}`);
        assert.deepEqual(x.json, errorIdInvalido(ID_NO_DECIMAL), `${metodo} ${plantilla} ${v}`);
      }
      const grande = await admin$(metodo, plantilla.replace(':id', '2147483648'), cuerpo);
      assert.equal(grande.status, 400);
      assert.deepEqual(grande.json, errorIdInvalido(ID_DEMASIADO_GRANDE));
    }
    const r = await admin$('GET', '/api/admin/cursos/2147483647');
    assert.equal(r.status, 404);
    assert.deepEqual(r.json.error, { codigo: 'NO_ENCONTRADO', mensaje: 'Curso no disponible.' });
  });
});

describe('GET /api/admin/cursos (CAR-REV-01, 02)', () => {
  it('CAR-REV-01: la cola contiene solo EN_REVISION', async () => {
    const a = await enRevision();
    const b = await enRevision();
    const { idCurso: borrador } = await c.cursoCompleto(docA);
    const r = await admin$('GET', '/api/admin/cursos');
    assert.equal(r.status, 200);
    // Sprint 4 (034): cada curso trae inscritos, actualizadoEn y suspension, y la respuesta los conteos por estado.
    assert.deepEqual(forma(r.json), {
      items: [{ id: 'number', titulo: 'string', estado: 'string', motivoRechazo: 'null', docente: 'string', modulos: 'number',
        portadaUrl: 'string', inscritos: 'number', actualizadoEn: 'string', suspension: 'null' }],
      conteos: { EN_REVISION: 'number', PUBLICADO: 'number', SUSPENDIDO: 'number', RECHAZADO: 'number', BORRADOR: 'number' },
    });
    const lista: any[] = r.json.items;
    const ids = lista.map((x) => x.id);
    assert.ok(ids.includes(a) && ids.includes(b));
    assert.ok(!ids.includes(borrador));
    assert.ok(lista.every((x) => x.estado === 'EN_REVISION'));
    assert.ok(ids.indexOf(a) < ids.indexOf(b), 'la cola va de la más antigua a la más reciente');
    assert.deepEqual(sinRutasPrivadas(r.json), []);
  });
  it('CAR-REV-02: filtro estado', async () => {
    assert.equal((await admin$('GET', '/api/admin/cursos?estado=EN_REVISION')).status, 200);
    // Sprint 4 (034): las pestañas de Revisión admiten PUBLICADO, SUSPENDIDO, RECHAZADO y BORRADOR; ARCHIVADO no.
    assert.equal((await admin$('GET', '/api/admin/cursos?estado=PUBLICADO')).status, 200);
    assert.equal((await admin$('GET', '/api/admin/cursos?estado=ARCHIVADO')).status, 400);
    assert.equal((await admin$('GET', '/api/admin/cursos?extra=1')).status, 400);
  });
});

describe('GET /api/admin/cursos/:id (CAR-REV-03, 04)', () => {
  it('CAR-REV-03: detalle de un curso EN_REVISION sin rutas físicas', async () => {
    const id = await enRevision();
    const r = await admin$('GET', `/api/admin/cursos/${id}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.validacion, { completo: true, problemas: [] });
    assert.equal(r.json.estado, 'EN_REVISION');
    assert.deepEqual(sinRutasPrivadas(r.json), []);
    assert.ok(!r.texto.includes(pdfDir.dir));
  });
  it('CAR-REV-04: curso en otro estado e inexistente', async () => {
    const { idCurso } = await c.cursoCompleto(docA);
    const borrador = await admin$('GET', `/api/admin/cursos/${idCurso}`);
    assert.equal(borrador.status, 200, 'el detalle de revisión responde también para cursos fuera de la cola');
    const inex = await admin$('GET', '/api/admin/cursos/2147483647');
    assert.equal(inex.status, 404);
  });
});

describe('PUT /api/admin/cursos/:id/revision (CAR-REV-05..09)', () => {
  it('CAR-REV-05: APROBAR publica, fija revisor y fecha y aparece en el catálogo', async () => {
    const id = await enRevision();
    const r = await admin$('PUT', `/api/admin/cursos/${id}/revision`, { decision: 'APROBAR' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.estado, 'PUBLICADO');
    const { rows } = await f.query('SELECT estado, revisado_por, publicado_en IS NOT NULL AS con_fecha, motivo_rechazo FROM curso WHERE id_curso = $1', [id]);
    assert.deepEqual(rows[0], { estado: 'PUBLICADO', revisado_por: admin.idPersona, con_fecha: true, motivo_rechazo: null });
    const cat = await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca)}&limite=50`);
    assert.equal(cat.status, 200);
    assert.ok(cat.json.items.some((x: any) => x.id === id));
    const det = await srv.pedir(`/api/cursos/${id}`);
    assert.equal(det.status, 200);
    assert.deepEqual(sinRutasPrivadas(det.json), []);
  });

  it('CAR-REV-06: RECHAZAR con motivo y el docente lo ve', async () => {
    const id = await enRevision();
    const r = await admin$('PUT', `/api/admin/cursos/${id}/revision`, { decision: 'RECHAZAR', motivo: 'Falta material' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.estado, 'RECHAZADO');
    const { rows } = await f.query('SELECT estado, motivo_rechazo, revisado_por FROM curso WHERE id_curso = $1', [id]);
    assert.deepEqual(rows[0], { estado: 'RECHAZADO', motivo_rechazo: 'Falta material', revisado_por: admin.idPersona });
    const propio = await c.como(docA, 'GET', `/api/docente/cursos/${id}`);
    assert.equal(propio.json.estado, 'RECHAZADO');
    assert.equal(propio.json.motivoRechazo, 'Falta material');
    const cat = await srv.pedir(`/api/cursos/${id}`);
    assert.equal(cat.status, 404);
  });

  it('CAR-REV-07: validación de la decisión', async () => {
    const id = await enRevision();
    const ruta = `/api/admin/cursos/${id}/revision`;
    const malos: unknown[] = [
      { decision: 'RECHAZAR' },
      { decision: 'RECHAZAR', motivo: '' },
      { decision: 'RECHAZAR', motivo: '   ' },
      { decision: 'RECHAZAR', motivo: 'x'.repeat(301) },
      { decision: 'OTRA' },
      { decision: 'APROBAR', extra: 1 },
      { decision: 'APROBAR', motivo: 'no aplica' },
      { decision: 'RECHAZAR', motivo: 'ok', extra: 1 },
      {},
    ];
    for (const cuerpo of malos) {
      const r = await admin$('PUT', ruta, cuerpo);
      assert.equal(r.status, 400, JSON.stringify(cuerpo));
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    }
    const estado = await f.query('SELECT estado FROM curso WHERE id_curso = $1', [id]);
    assert.equal(estado.rows[0]!.estado, 'EN_REVISION');
    const ok = await admin$('PUT', ruta, { decision: 'RECHAZAR', motivo: 'x'.repeat(300) });
    assert.equal(ok.status, 200);
  });

  it('CAR-REV-08: curso ya decidido -> 409; dos administradores a la vez -> un 200 y un 409', async () => {
    const id = await enRevision();
    const ruta = `/api/admin/cursos/${id}/revision`;
    const [a, b] = await Promise.all([
      admin$('PUT', ruta, { decision: 'APROBAR' }),
      admin$('PUT', ruta, { decision: 'APROBAR' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const perdedora = a.status === 409 ? a : b;
    assert.equal(perdedora.json.error.mensaje, 'Este curso ya no está pendiente de revisión.');
    assert.equal(perdedora.json.error.codigo, 'CONFLICTO');
    const otra = await admin$('PUT', ruta, { decision: 'RECHAZAR', motivo: 'tarde' });
    assert.equal(otra.status, 409);
    const inex = await admin$('PUT', '/api/admin/cursos/2147483647/revision', { decision: 'APROBAR' });
    assert.equal(inex.status, 404);
  });

  it('CAR-REV-09: aprobar revalida PDF, objetivos y categoría', async () => {
    // PDF borrado del disco
    const sinFichero = await c.cursoCompleto(docA);
    await c.enviarARevision(docA, sinFichero.idCurso);
    const { rows: [fila] } = await f.query<{ ruta: string }>('SELECT ruta FROM archivo WHERE id_archivo = $1', [sinFichero.idArchivo]);
    const nombre = path.basename(fila!.ruta);
    try { unlinkSync(path.join(pdfDir.dir, nombre)); } catch { /* ruta relativa: se busca por nombre */ }
    assert.ok(!ficheros(pdfDir.dir).includes(nombre));
    const a = await admin$('PUT', `/api/admin/cursos/${sinFichero.idCurso}/revision`, { decision: 'APROBAR' });
    assert.equal(a.status, 409);
    assert.equal(a.json.error.codigo, 'CURSO_INCOMPLETO');
    assert.equal(a.json.error.mensaje, 'El curso dejó de cumplir la validación. Actualiza su contenido.');
    assert.equal(a.json.error.detalles[0].campo, 'modulos.0.lecciones.0.archivo');
    // Objetivos insuficientes
    const pocos = await enRevision();
    await f.query("UPDATE curso SET objetivos = '{uno}' WHERE id_curso = $1", [pocos]);
    const b = await admin$('PUT', `/api/admin/cursos/${pocos}/revision`, { decision: 'APROBAR' });
    assert.equal(b.status, 409);
    assert.equal(b.json.error.codigo, 'CURSO_INCOMPLETO');
    assert.equal(b.json.error.detalles[0].campo, 'objetivos');
    // Categoría inactiva
    const inactiva = await enRevision();
    await f.query('UPDATE categoria SET activa = FALSE WHERE id_categoria = $1', [categoriaId]);
    const d = await admin$('PUT', `/api/admin/cursos/${inactiva}/revision`, { decision: 'APROBAR' });
    assert.equal(d.status, 409);
    assert.equal(d.json.error.codigo, 'CURSO_INCOMPLETO');
    assert.equal(d.json.error.detalles[0].campo, 'categoriaId');
    await f.query('UPDATE categoria SET activa = TRUE WHERE id_categoria = $1', [categoriaId]);
  });
});
