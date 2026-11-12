import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-hpr-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';

const { carpetaPdfPropia } = await import('./ayudas/archivos.js');
const { crearFixtures } = await import('./ayudas/bd-fixtures.js');
const { fabricaCursos } = await import('./ayudas/cursos-http.js');
const { CONTRASENA_PRUEBA, crearMarca, generadorCorreos } = await import('./ayudas/datos.js');
const { iniciarServidor } = await import('./ayudas/servidor.js');
const { fabricaCuentas, limpiarMarca } = await import('./ayudas/sesiones.js');
const { identidadApi } = await import('../src/modules/identidad/index.js');
import type { Fixtures } from './ayudas/bd-fixtures.js';
import type { Servidor } from './ayudas/servidor.js';
import type { Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_hpr');
const pdfDir = carpetaPdfPropia();
const genCorreo = generadorCorreos(marca);
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let admin: Cuenta;
let ana: Cuenta;
let beto: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let resenaId = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  ana = await cuentas.crearCuenta(['ESTUDIANTE']);
  beto = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  cursoId = (await c.cursoCompleto(docente)).idCurso;
  await c.enviarARevision(docente, cursoId);
  assert.equal((await c.como(admin, 'PUT', `/api/admin/cursos/${cursoId}/revision`, { decision: 'APROBAR' })).status, 200);
  assert.equal((await c.como(ana, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
  const resena = await c.como(ana, 'PUT', `/api/cursos/${cursoId}/resena`, { estrellas: 5, comentario: 'Curso muy completo.' });
  assert.equal(resena.status, 200);
  resenaId = resena.json.id;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
  await rm(BUZON, { recursive: true, force: true });
});

describe('Sprint 4 · Perfil extendido, cambio de correo, hilos en reseñas, reportes y especialidades', () => {
  it('actualiza país, provincia, ciudad y fecha de nacimiento calculando la edad automáticamente', async () => {
    const r = await c.como(ana, 'PUT', '/api/perfil', {
      nombres: marca,
      apellidos: 'Estudiante',
      pais: 'Ecuador',
      provincia: 'Pichincha',
      ciudad: 'Quito',
      fechaNacimiento: '2000-01-15',
      biografia: 'Aprendiendo en Learnity',
    });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.pais, 'Ecuador');
    assert.equal(r.json.provincia, 'Pichincha');
    assert.equal(r.json.ciudad, 'Quito');
    assert.equal(r.json.fechaNacimiento, '2000-01-15');
    assert.equal(typeof r.json.edad, 'number');
    assert.ok(r.json.edad >= 25);
  });

  it('permite solicitar y confirmar el cambio privado de correo electrónico con enlace de un solo uso', async () => {
    const nuevoCorreo = genCorreo('nuevo_ana');
    const sol = await c.como(ana, 'POST', '/api/perfil/correo', {
      nuevoCorreo,
      contrasenaActual: CONTRASENA_PRUEBA,
    });
    assert.equal(sol.status, 202, sol.texto);
    await identidadApi.esperarTareas();
    const mensajes = await Promise.all(
      (await readdir(BUZON)).map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))),
    );
    const enviados = mensajes.filter((m) => m.para === nuevoCorreo);
    assert.equal(enviados.length, 1);
    const match = enviados[0]!.texto.match(/\/confirmar-correo#token=([A-Za-z0-9_-]+)/);
    assert.ok(match?.[1], 'El correo debe enlazar a /confirmar-correo#token=');

    const conf = await srv.pedir('/api/auth/confirmar-correo', {
      metodo: 'POST',
      cuerpo: { token: match[1] },
    });
    assert.equal(conf.status, 200, conf.texto);
    assert.equal(conf.json.correo, nuevoCorreo);

    const perfil = await c.como(ana, 'GET', '/api/perfil');
    assert.equal(perfil.json.correo, nuevoCorreo);

    // El enlace es de un solo uso.
    const otraVez = await srv.pedir('/api/auth/confirmar-correo', { metodo: 'POST', cuerpo: { token: match[1] } });
    assert.equal(otraVez.status, 400);
  });

  it('rechaza al instante un correo que ya pertenece a otra cuenta, con el mensaje junto al campo', async () => {
    const correoDeBeto = (await c.como(beto, 'GET', '/api/perfil')).json.correo as string;
    const r = await c.como(docente, 'POST', '/api/perfil/correo', {
      nuevoCorreo: correoDeBeto.toUpperCase(),
      contrasenaActual: CONTRASENA_PRUEBA,
    });
    assert.equal(r.status, 409, r.texto);
    assert.equal(r.json.error.codigo, 'CORREO_DUPLICADO');
    assert.equal(r.json.error.mensaje, 'Este correo electrónico ya está asociado a otra cuenta.');
    assert.deepEqual(r.json.error.detalles, [
      { campo: 'nuevoCorreo', mensaje: 'Este correo electrónico ya está asociado a otra cuenta.' },
    ]);

    const porAdmin = await c.como(admin, 'POST', `/api/admin/usuarios/${docente.idUsuario}/correo`, { nuevoCorreo: correoDeBeto });
    assert.equal(porAdmin.status, 409, porAdmin.texto);
    assert.equal(porAdmin.json.error.mensaje, 'Este correo electrónico ya está asociado a otra cuenta.');
  });

  it('crea y elimina respuestas en el hilo de una reseña identificando al docente del curso', async () => {
    const sinInscribir = await c.como(beto, 'POST', `/api/resenas/${resenaId}/respuestas`, {
      comentario: '¿Incluye ejercicios prácticos?',
    });
    assert.equal(sinInscribir.status, 403);

    assert.equal((await c.como(beto, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);

    const rEst = await c.como(beto, 'POST', `/api/resenas/${resenaId}/respuestas`, {
      comentario: '¿Incluye ejercicios prácticos?',
    });
    assert.equal(rEst.status, 201, rEst.texto);
    assert.equal(rEst.json.esDocente, false);
    assert.equal(rEst.json.propia, true);

    const rDoc = await c.como(docente, 'POST', `/api/resenas/${resenaId}/respuestas`, {
      comentario: 'Sí, en todos los módulos encontrarás retos.',
    });
    assert.equal(rDoc.status, 201, rDoc.texto);
    assert.equal(rDoc.json.esDocente, true);

    const publicas = await srv.pedir(`/api/cursos/${cursoId}/resenas`);
    assert.equal(publicas.status, 200);
    const item = publicas.json.items.find((x: { id: number }) => x.id === resenaId);
    assert.equal(item.respuestas.length, 2);
    assert.equal(item.respuestas[0].esDocente, false);
    assert.equal(item.respuestas[1].esDocente, true);

    const del = await c.como(beto, 'DELETE', `/api/resenas/${resenaId}/respuestas/${rEst.json.id}`);
    assert.equal(del.status, 204);
  });

  it('el administrador oculta y restaura respuestas del hilo, y el historial completo registra cada evento', async () => {
    const r = await c.como(beto, 'POST', `/api/resenas/${resenaId}/respuestas`, { comentario: 'Respuesta para moderar.' });
    assert.equal(r.status, 201, r.texto);
    const ruta = `/api/admin/resenas/${resenaId}/respuestas/${r.json.id}/ocultacion`;
    const publicas = async () =>
      ((await srv.pedir(`/api/cursos/${cursoId}/resenas`)).json.items as { id: number; respuestas: { id: number }[] }[])
        .find((x) => x.id === resenaId)!.respuestas.map((x) => x.id);

    const oculta = await c.como(admin, 'POST', ruta);
    assert.equal(oculta.status, 200, oculta.texto);
    const enAdmin = oculta.json.respuestas.find((x: { id: number }) => x.id === r.json.id);
    assert.ok(enAdmin?.ocultada?.fecha, 'el administrador sigue viendo la respuesta, marcada como oculta');
    assert.equal(enAdmin.ocultada.por.id, admin.idPersona);
    assert.ok(!(await publicas()).includes(r.json.id), 'la respuesta oculta no se ve en el curso');
    assert.equal((await c.como(admin, 'POST', ruta)).status, 409);
    assert.equal((await c.como(docente, 'POST', ruta)).status, 403);

    const restaurada = await c.como(admin, 'DELETE', ruta);
    assert.equal(restaurada.status, 200, restaurada.texto);
    assert.equal(restaurada.json.respuestas.find((x: { id: number }) => x.id === r.json.id).ocultada, null);
    assert.ok((await publicas()).includes(r.json.id));
    assert.equal((await c.como(admin, 'DELETE', ruta)).status, 409);

    const historial = (await c.como(admin, 'GET', `/api/admin/resenas/${resenaId}/historial`)).json as {
      accion: string; actor: { id: number } | null; comentarioNuevo: string | null;
    }[];
    const delHilo = historial.filter((e) => e.accion.startsWith('HILO_') && e.comentarioNuevo === 'Respuesta para moderar.');
    assert.deepEqual(delHilo.map((e) => e.accion), ['HILO_PUBLICADA', 'HILO_OCULTADA', 'HILO_RESTAURADA']);
    assert.equal(delHilo[0]!.actor?.id, beto.idPersona);
    assert.equal(delHilo[1]!.actor?.id, admin.idPersona);
    assert.ok(historial.some((e) => e.accion === 'CREADA'), 'también conserva los eventos de la reseña');
    assert.ok(historial.length > delHilo.length);

    const inexistente = await c.como(admin, 'POST', `/api/admin/resenas/${resenaId}/respuestas/2147483000/ocultacion`);
    assert.equal(inexistente.status, 404);
  });

  it('la respuesta del docente en el hilo cuenta como respondida en su bandeja', async () => {
    const sinResponder = async () =>
      ((await c.como(docente, 'GET', `/api/docente/resenas?curso=${cursoId}&respuesta=sin-responder`)).json.items as { id: number }[])
        .map((x) => x.id);
    const respondidas = async () =>
      ((await c.como(docente, 'GET', `/api/docente/resenas?curso=${cursoId}&respuesta=respondidas`)).json.items as { id: number }[])
        .map((x) => x.id);

    const bandeja = await c.como(docente, 'GET', `/api/docente/resenas?curso=${cursoId}`);
    assert.equal(bandeja.status, 200, bandeja.texto);
    // La prueba anterior del hilo ya dejó una respuesta del docente en esta reseña.
    assert.ok((await respondidas()).includes(resenaId));
    assert.ok(!(await sinResponder()).includes(resenaId));
    assert.equal(bandeja.json.resumen.sinResponder, 0);
  });

  it('permite a un estudiante reportar un curso publicado y genera una alerta REPORTE_CURSO con enlace a revisión', async () => {
    const rep = await c.como(ana, 'POST', `/api/cursos/${cursoId}/reportar`, {
      motivo: 'El vídeo de la primera lección contiene material desactualizado.',
    });
    assert.equal(rep.status, 201, rep.texto);
    assert.ok(rep.json.mensaje);

    const alertas = await c.como(admin, 'GET', '/api/admin/alertas?tipo=REPORTE_CURSO');
    assert.equal(alertas.status, 200, alertas.texto);
    const encontrada = alertas.json.items.find((a: { evidencia: { curso?: number } }) => a.evidencia.curso === cursoId);
    assert.ok(encontrada, 'La alerta REPORTE_CURSO debe aparecer en /api/admin/alertas');
    assert.equal(encontrada.evidencia.idCurso, cursoId);
    assert.equal(encontrada.evidencia.curso, cursoId);
  });

  it('permite a un docente activo solicitar una especialidad o categoría adicional', async () => {
    const r = await c.como(docente, 'POST', '/api/solicitudes-docente/especialidad', {
      especialidad: 'Ciencia de Datos',
      motivo: 'Cuento con 5 años de experiencia liderando proyectos de analítica y aprendizaje automático.',
    });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.especialidad, 'Ciencia de Datos');
    assert.equal(r.json.estado, 'PENDIENTE');
  });
});
