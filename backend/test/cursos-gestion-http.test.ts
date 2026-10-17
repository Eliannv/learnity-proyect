
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import type {
  Rol,
  UsuarioSesion,
} from '../src/shared/auth/tipos.js';

if (
  process.env['NODE_ENV'] !== 'test' ||
  !process.env['DB_NAME']?.endsWith('_test')
) {
  throw new Error(
    'Estas pruebas requieren NODE_ENV=test y una base _test.',
  );
}

const { crearApp } = await import('../src/app.js');
const { pool } = await import(
  '../src/shared/database/pool.js'
);
const { firmarAccessToken } = await import(
  '../src/shared/auth/jwt.js'
);

const marca = 'melissa_' + randomUUID().slice(0, 8);

interface Cuenta {
  token: string;
  idPersona: number;
}

let servidor: ReturnType<ReturnType<
  typeof crearApp
>['listen']> | undefined;

let base = '';
let categoriaId = 0;
let docente: Cuenta;
let otroDocente: Cuenta;
let estudiante: Cuenta;

const personas: number[] = [];
const cursos: number[] = [];

async function crearCuenta(rol: Rol): Promise<Cuenta> {
  const p = await pool.query<{ id: number }>(
    `INSERT INTO persona (nombres, apellidos)
     VALUES ($1, $2)
     RETURNING id_persona AS id`,
    [marca, rol],
  );

  const idPersona = p.rows[0]!.id;
  personas.push(idPersona);

  const correo = `${marca}_${idPersona}@pruebas.test`;

  const u = await pool.query<{ id: number }>(
    `INSERT INTO usuario
       (id_persona, correo, contrasena_hash)
     VALUES ($1, $2, $3)
     RETURNING id_usuario AS id`,
    [idPersona, correo, 'x'.repeat(60)],
  );

  const idUsuario = u.rows[0]!.id;

  const roles: Rol[] = rol === 'ESTUDIANTE'
    ? ['ESTUDIANTE']
    : ['ESTUDIANTE', rol];

  await pool.query(
    `INSERT INTO usuario_rol (id_usuario, id_rol)
     SELECT $1, id_rol
     FROM rol
     WHERE nombre = ANY($2::text[])`,
    [idUsuario, roles],
  );

  if (rol === 'DOCENTE') {
    await pool.query(
      `INSERT INTO docente (id_persona, especialidad)
       VALUES ($1, 'Pruebas de cursos')`,
      [idPersona],
    );
  }

  const sid = randomUUID();

  await pool.query(
    `INSERT INTO sesion (
       id_usuario, familia, token_hash,
       iniciada_en, expira_en
     )
     VALUES ($1, $2, $3, now(), now() + interval '1 day')`,
    [
      idUsuario,
      sid,
      randomUUID().replaceAll('-', '').repeat(2),
    ],
  );

  const sesion: UsuarioSesion = {
    idUsuario,
    idPersona,
    correo,
    roles,
    sid,
  };

  return {
    idPersona,
    token: firmarAccessToken(sesion).token,
  };
}

async function pedir(
  ruta: string,
  cuenta: Cuenta | null,
  metodo = 'GET',
  cuerpo?: unknown,
) {
  const headers: Record<string, string> = {};

  if (cuenta) {
    headers['authorization'] = 'Bearer ' + cuenta.token;
  }

  if (cuerpo !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers,
    body: cuerpo === undefined
      ? undefined
      : JSON.stringify(cuerpo),
  });

  return {
    status: respuesta.status,
    json: await respuesta.json() as any,
  };
}

function datosCurso(titulo: string) {
  return {
    titulo,
    subtitulo: 'Curso de integración',
    descripcion: 'Descripción para pruebas',
    categoriaId,
    nivel: 'PRINCIPIANTE',
    portadaUrl: '/img/portada-mi-curso.jpg',
    objetivos: [
      'Comprender los fundamentos',
      'Identificar conceptos básicos',
      'Resolver problemas prácticos',
    ],
    requisitos: [],
  };
}

async function crearCurso() {
  const r = await pedir(
    '/api/cursos',
    docente,
    'POST',
    datosCurso('Curso ' + randomUUID().slice(0, 6)),
  );

  assert.equal(r.status, 201);
  assert.equal(r.json.estado, 'BORRADOR');

  cursos.push(r.json.id as number);
  return r.json.id as number;
}

before(async () => {
  docente = await crearCuenta('DOCENTE');
  otroDocente = await crearCuenta('DOCENTE');
  estudiante = await crearCuenta('ESTUDIANTE');

  const cat = await pool.query<{ id: number }>(
    `INSERT INTO categoria (nombre, creada_por)
     VALUES ($1, $2)
     RETURNING id_categoria AS id`,
    [marca, docente.idPersona],
  );

  categoriaId = cat.rows[0]!.id;

  servidor = crearApp().listen(0);

  await new Promise<void>(resolve =>
    servidor!.once('listening', resolve),
  );

  base = 'http://127.0.0.1:' +
    (servidor.address() as AddressInfo).port;
});

after(async () => {
  try {
    if (servidor) {
      await new Promise<void>(resolve =>
        servidor!.close(() => resolve()),
      );
    }

    if (cursos.length) {
      await pool.query(
        'DELETE FROM curso WHERE id_curso = ANY($1::int[])',
        [cursos],
      );
    }

    if (categoriaId) {
      await pool.query(
        'DELETE FROM categoria WHERE id_categoria = $1',
        [categoriaId],
      );
    }

    if (personas.length) {
      await pool.query(
        'DELETE FROM docente WHERE id_persona = ANY($1::int[])',
        [personas],
      );

      await pool.query(
        'DELETE FROM usuario WHERE id_persona = ANY($1::int[])',
        [personas],
      );

      await pool.query(
        'DELETE FROM persona WHERE id_persona = ANY($1::int[])',
        [personas],
      );
    }
  } finally {
    await pool.end();
  }
});

describe('Integrante 2 - Seguridad HTTP de Cursos', () => {
  it('rechaza a estudiantes y usuarios sin sesión', async () => {
    const datos = datosCurso('Curso no autorizado');

    assert.equal(
      (await pedir('/api/cursos', estudiante, 'POST', datos)).status,
      403,
    );

    assert.equal(
      (await pedir('/api/cursos', null, 'POST', datos)).status,
      401,
    );
  });

  it('impide editar un curso de otro docente', async () => {
    const id = await crearCurso();

    const r = await pedir(
      `/api/cursos/${id}`,
      otroDocente,
      'PUT',
      datosCurso('Intento ajeno'),
    );

    assert.equal(r.status, 403);
  });

  it('bloquea la edición de un curso publicado', async () => {
    const id = await crearCurso();

    await pool.query(
      `UPDATE curso
       SET estado = 'PUBLICADO',
           publicado_en = now()
       WHERE id_curso = $1`,
      [id],
    );

    const r = await pedir(
      `/api/cursos/${id}`,
      docente,
      'PUT',
      datosCurso('Intento bloqueado'),
    );

    assert.equal(r.status, 409);
    assert.equal(r.json.error.codigo, 'CURSO_BLOQUEADO');
  });

  it('rechaza órdenes duplicados de módulos', async () => {
    const id = await crearCurso();

    const primero = await pedir(
      `/api/cursos/${id}/modulos`,
      docente,
      'POST',
      { titulo: 'Módulo 1', orden: 1 },
    );

    assert.equal(primero.status, 201);

    const duplicado = await pedir(
      `/api/cursos/${id}/modulos`,
      docente,
      'POST',
      { titulo: 'Otro módulo', orden: 1 },
    );

    assert.equal(duplicado.status, 400);

    const { rows } = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM modulo WHERE id_curso = $1`,
      [id],
    );

    assert.equal(rows[0]!.total, 1);
  });

  it('no permite enviar un curso incompleto', async () => {
    const id = await crearCurso();

    const r = await pedir(
      `/api/cursos/${id}/enviar-revision`,
      docente,
      'POST',
      {},
    );

    assert.equal(r.status, 400);
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');

    const { rows } = await pool.query<{ estado: string }>(
      'SELECT estado FROM curso WHERE id_curso = $1',
      [id],
    );

    assert.equal(rows[0]!.estado, 'BORRADOR');
  });
});
