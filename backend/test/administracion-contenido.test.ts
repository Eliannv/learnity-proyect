import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {
  after,
  before,
  describe,
  it,
} from 'node:test';

import { PDFDocument } from 'pdf-lib';

import type {
  Rol,
  UsuarioSesion,
} from '../src/shared/auth/tipos.js';

if (
  process.env['NODE_ENV'] !== 'test' ||
  !process.env['DB_NAME']?.endsWith('_test')
) {
  throw new Error(
    'Usa NODE_ENV=test y una base exclusiva cuyo nombre termine en _test.',
  );
}

const carpeta = await mkdtemp(
  path.join(os.tmpdir(), 'learnity-pdf-'),
);

process.env['PDF_DIR'] = carpeta;

const { crearApp } = await import('../src/app.js');

const {
  pool,
  enTransaccion,
} = await import('../src/shared/database/pool.js');

const {
  firmarAccessToken,
} = await import('../src/shared/auth/jwt.js');

const {
  cursosService,
} = await import('../src/modules/cursos/cursos.service.js');

const {
  contenidoService,
} = await import('../src/modules/contenido/contenido.service.js');

const {
  limpiezaPdfService,
} = await import('../src/modules/contenido/contenido-limpieza.service.js');

const {
  almacenLocal,
} = await import('../src/shared/archivos/almacen.js');

const {
  MAX_PDF_BYTES,
} = await import('../src/shared/archivos/pdf-validacion.js');

const marca = 'i3_' + randomUUID().slice(0, 8);

const personas: number[] = [];
const cursos: number[] = [];

let categoriaId = 0;
let base = '';
let pdf: Buffer;

let servidor:
  | ReturnType<ReturnType<typeof crearApp>['listen']>
  | undefined;

interface Cuenta {
  sesion: UsuarioSesion;
  token: string;
  docenteId: number | null;
}

let docente: Cuenta;
let ajeno: Cuenta;
let admin: Cuenta;
let admin2: Cuenta;
let estudiante: Cuenta;

async function cuenta(rol: Rol): Promise<Cuenta> {
  const p = await pool.query<{ id: number }>(
    `
      INSERT INTO persona (nombres, apellidos)
      VALUES ($1, $2)
      RETURNING id_persona AS id
    `,
    [marca, rol],
  );

  const idPersona = p.rows[0]!.id;
  personas.push(idPersona);

  const correo =
    marca + '_' + idPersona + '@pruebas.test';

  const u = await pool.query<{ id: number }>(
    `
      INSERT INTO usuario (
        id_persona,
        correo,
        contrasena_hash
      )
      VALUES ($1, $2, $3)
      RETURNING id_usuario AS id
    `,
    [idPersona, correo, 'x'.repeat(60)],
  );

  const idUsuario = u.rows[0]!.id;

  const roles: Rol[] =
    rol === 'ESTUDIANTE'
      ? ['ESTUDIANTE']
      : ['ESTUDIANTE', rol];

  await pool.query(
    `
      INSERT INTO usuario_rol (id_usuario, id_rol)
      SELECT $1, id_rol
      FROM rol
      WHERE nombre = ANY($2::text[])
    `,
    [idUsuario, roles],
  );

  let docenteId: number | null = null;

  if (rol === 'DOCENTE') {
    const d = await pool.query<{ id: number }>(
      `
        INSERT INTO docente (
          id_persona,
          especialidad
        )
        VALUES ($1, 'Pruebas')
        RETURNING id_docente AS id
      `,
      [idPersona],
    );

    docenteId = d.rows[0]!.id;
  }

  const sid = randomUUID();

  await pool.query(
    `
      INSERT INTO sesion (
        id_usuario,
        familia,
        token_hash,
        iniciada_en,
        expira_en
      )
      VALUES (
        $1,
        $2,
        $3,
        now(),
        now() + interval '1 day'
      )
    `,
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
    sesion,
    token: firmarAccessToken(sesion).token,
    docenteId,
  };
}

async function escenario(
  estado = 'BORRADOR',
  tipo = 'DOCUMENTO',
) {
  const c = await pool.query<{ id: number }>(
    `
      INSERT INTO curso (
        id_docente,
        id_categoria,
        titulo,
        subtitulo,
        descripcion,
        nivel,
        portada_url,
        objetivos,
        estado,
        motivo_rechazo
      )
      VALUES (
        $1,
        $2,
        $3,
        'Subtítulo',
        'Descripción del curso',
        'PRINCIPIANTE',
        '/img/portada-mi-curso.jpg',
        $4,
        $5,
        $6
      )
      RETURNING id_curso AS id
    `,
    [
      docente.docenteId,
      categoriaId,
      marca + ' curso ' + cursos.length,
      [
        'Objetivo uno',
        'Objetivo dos',
        'Objetivo tres',
      ],
      estado,
      estado === 'RECHAZADO'
        ? 'Completa el material.'
        : null,
    ],
  );

  const id = c.rows[0]!.id;
  cursos.push(id);

  const m = await pool.query<{ id: number }>(
    `
      INSERT INTO modulo (
        id_curso,
        titulo,
        orden
      )
      VALUES ($1, 'Módulo inicial', 1)
      RETURNING id_modulo AS id
    `,
    [id],
  );

  const l = await pool.query<{ id: number }>(
    `
      INSERT INTO leccion (
        id_modulo,
        titulo,
        tipo,
        orden
      )
      VALUES ($1, 'Lección inicial', $2, 1)
      RETURNING id_leccion AS id
    `,
    [m.rows[0]!.id, tipo],
  );

  return {
    id,
    leccion: l.rows[0]!.id,
  };
}

async function pedir(
  ruta: string,
  quien: Cuenta | null = admin,
  metodo = 'GET',
  cuerpo?: unknown,
) {
  const headers: Record<string, string> = {};

  if (quien) {
    headers['authorization'] =
      'Bearer ' + quien.token;
  }

  if (cuerpo !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers,
    body:
      cuerpo === undefined
        ? undefined
        : JSON.stringify(cuerpo),
  });

  return {
    status: respuesta.status,
    json: await respuesta.json() as any,
  };
}

async function subir(
  leccion: number,
  quien: Cuenta | null = docente,
  bytes = pdf,
  nombre = 'leccion.pdf',
  campo = 'archivo',
) {
  const form = new FormData();

  form.append(
    campo,
    new Blob(
      [new Uint8Array(bytes)],
      { type: 'application/pdf' },
    ),
    nombre,
  );

  const respuesta = await fetch(
    base + '/api/lecciones/' + leccion + '/archivo',
    {
      method: 'POST',
      headers: quien
        ? { authorization: 'Bearer ' + quien.token }
        : {},
      body: form,
    },
  );

  return {
    status: respuesta.status,
    json: await respuesta.json() as any,
  };
}

async function rutaArchivo(
  id: number,
): Promise<string> {
  const { rows } = await pool.query<{
    ruta: string;
  }>(
    'SELECT ruta FROM archivo WHERE id_archivo = $1',
    [id],
  );

  return rows[0]!.ruta;
}

before(async () => {
  const documento = await PDFDocument.create();

  documento.addPage();

  pdf = Buffer.from(await documento.save());

  docente = await cuenta('DOCENTE');
  ajeno = await cuenta('DOCENTE');
  admin = await cuenta('ADMIN');
  admin2 = await cuenta('ADMIN');
  estudiante = await cuenta('ESTUDIANTE');

  const c = await pool.query<{ id: number }>(
    `
      INSERT INTO categoria (nombre, creada_por)
      VALUES ($1, $2)
      RETURNING id_categoria AS id
    `,
    [marca, admin.sesion.idPersona],
  );

  categoriaId = c.rows[0]!.id;

  servidor = crearApp().listen(0);

  await new Promise<void>(
    resolve => servidor!.once('listening', resolve),
  );

  base =
    'http://127.0.0.1:' +
    (servidor.address() as AddressInfo).port;
});

after(async () => {
  if (servidor) {
    await new Promise<void>(
      resolve => servidor!.close(() => resolve()),
    );
  }

  const nombres = await readdir(carpeta);

  if (nombres.length) {
    await pool.query(
      `
        DELETE FROM archivo_borrado_pendiente
        WHERE nombre = ANY($1::text[])
      `,
      [nombres],
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

  await pool.end();

  await rm(carpeta, {
    recursive: true,
    force: true,
  });
});

describe(
  'Administración y Contenido con HTTP, sesiones y PostgreSQL reales',
  () => {
    it(
      'protege rutas con sesión y rol; una sesión revocada deja de funcionar',
      async () => {
        assert.equal(
          (await pedir('/api/admin/cursos', null)).status,
          401,
        );

        for (const usuario of [
          docente,
          ajeno,
          estudiante,
        ]) {
          assert.equal(
            (await pedir('/api/admin/cursos', usuario)).status,
            403,
          );
        }

        await pool.query(
          `
            UPDATE sesion
            SET
              revocado_en = now(),
              motivo_revocacion = 'CIERRE'
            WHERE familia = $1
          `,
          [admin2.sesion.sid],
        );

        assert.equal(
          (await pedir('/api/admin/cursos', admin2)).status,
          401,
        );

        await pool.query(
          `
            UPDATE sesion
            SET
              revocado_en = NULL,
              motivo_revocacion = NULL
            WHERE familia = $1
          `,
          [admin2.sesion.sid],
        );
      },
    );

    it(
      'filtra la cola en el servidor y entrega el detalle completo sin rutas físicas',
      async () => {
        const pendiente = await escenario('EN_REVISION');
        const borrador = await escenario();

        const r = await pedir(
          '/api/admin/cursos?estado=EN_REVISION',
        );

        assert.equal(r.status, 200);

        assert.ok(
          r.json.items.some(
            (c: any) =>
              c.id === pendiente.id &&
              typeof c.modulos === 'number',
          ),
        );

        assert.ok(
          !r.json.items.some(
            (c: any) => c.id === borrador.id,
          ),
        );

        assert.ok(
          r.json.items.every(
            (c: any) => c.estado === 'EN_REVISION',
          ),
        );

        const detalle = await pedir(
          '/api/admin/cursos/' + pendiente.id,
        );

        assert.equal(detalle.status, 200);

        assert.equal(
          detalle.json.modulos[0].lecciones[0].archivo,
          null,
        );

        assert.equal(
          detalle.json.validacion.completo,
          false,
        );

        assert.ok(
          detalle.json.validacion.problemas.some(
            (p: any) => p.campo.endsWith('.archivo'),
          ),
        );

        for (const ruta of [
          '/api/admin/cursos?estado=PUBLICADO',
          '/api/admin/cursos?extra=1',
          '/api/admin/cursos/no-es-id',
        ]) {
          assert.equal((await pedir(ruta)).status, 400);
        }

        assert.equal(
          (await pedir('/api/admin/cursos/2147483647')).status,
          404,
        );
      },
    );

    it(
      'sube un PDF, devuelve CursoDetalle y permite descargar solo al propietario y ADMIN',
      async () => {
        const c = await escenario();

        const subida = await subir(
          c.leccion,
          docente,
          pdf,
          'lección.pdf',
        );

        assert.equal(subida.status, 200);
        assert.equal(subida.json.id, c.id);

        assert.equal(
          subida.json.validacion.completo,
          true,
        );

        const archivo =
          subida.json.modulos[0].lecciones[0].archivo;

        assert.deepEqual(
          Object.keys(archivo).sort(),
          [
            'id',
            'nombreOriginal',
            'tamanoBytes',
            'tipo',
          ],
        );

        assert.equal(archivo.tipo, 'PDF');
        assert.equal(archivo.nombreOriginal, 'lección.pdf');
        assert.equal(archivo.tamanoBytes, pdf.length);

        const serializado = JSON.stringify(subida.json);

        assert.ok(!serializado.includes(carpeta));

        assert.ok(
          !serializado.includes(
            await rutaArchivo(archivo.id),
          ),
        );

        for (const [quien, status] of [
          [docente, 200],
          [admin, 200],
          [ajeno, 403],
          [estudiante, 403],
          [null, 401],
        ] as const) {
          const respuesta = await fetch(
            base + '/api/archivos/' + archivo.id,
            {
              headers: quien
                ? {
                    authorization:
                      'Bearer ' + quien.token,
                  }
                : {},
            },
          );

          assert.equal(respuesta.status, status);

          if (status === 200) {
            assert.match(
              respuesta.headers.get('content-type')!,
              /^application\/pdf/,
            );

            assert.match(
              respuesta.headers.get('cache-control')!,
              /no-store/,
            );

            assert.deepEqual(
              Buffer.from(await respuesta.arrayBuffer()),
              pdf,
            );
          }
        }

        assert.equal(
          (await pedir(
            '/api/archivos/2147483647',
            docente,
          )).status,
          404,
        );
      },
    );

    it(
      'rechaza subidas sin permiso, de otro propietario o sobre estados y tipos bloqueados',
      async () => {
        const c = await escenario();

        for (const [quien, status] of [
          [admin, 403],
          [ajeno, 403],
          [estudiante, 403],
          [null, 401],
        ] as const) {
          assert.equal(
            (await subir(c.leccion, quien)).status,
            status,
          );
        }

        for (const estado of [
          'EN_REVISION',
          'PUBLICADO',
          'ARCHIVADO',
        ]) {
          const bloqueado = await escenario(estado);

          assert.equal(
            (await subir(bloqueado.leccion)).status,
            409,
          );
        }

        const video = await escenario(
          'BORRADOR',
          'VIDEO',
        );

        assert.equal(
          (await subir(video.leccion)).status,
          400,
        );

        assert.equal(
          (await subir(2147483647)).status,
          404,
        );

        const rechazado = await escenario('RECHAZADO');

        assert.equal(
          (await subir(rechazado.leccion)).status,
          200,
        );
      },
    );

    it(
      'comprueba multipart, nombre del campo, extensión, contenido y tamaño',
      async () => {
        const c = await escenario();

        assert.equal(
          (await subir(
            c.leccion,
            docente,
            pdf,
            'a.pdf',
            'otro',
          )).status,
          400,
        );

        assert.equal(
          (await subir(
            c.leccion,
            docente,
            pdf,
            'a.exe',
          )).status,
          415,
        );

        assert.equal(
          (await subir(
            c.leccion,
            docente,
            Buffer.from('%PDF-1.7\nfalso\n%%EOF'),
          )).status,
          400,
        );

        assert.equal(
          (await subir(
            c.leccion,
            docente,
            Buffer.alloc(0),
          )).status,
          400,
        );

        assert.equal(
          (await subir(
            c.leccion,
            docente,
            Buffer.alloc(MAX_PDF_BYTES + 1),
          )).status,
          413,
        );

        const falta = await fetch(
          base + '/api/lecciones/' + c.leccion + '/archivo',
          {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + docente.token,
            },
            body: new FormData(),
          },
        );

        assert.equal(falta.status, 400);

        assert.equal(
          (await pedir(
            '/api/lecciones/' + c.leccion + '/archivo',
            docente,
            'POST',
            {},
          )).status,
          415,
        );

        const pos = pdf.lastIndexOf('%%EOF');

        const exacto = Buffer.concat([
          pdf.subarray(0, pos),
          Buffer.alloc(MAX_PDF_BYTES - pdf.length, 32),
          pdf.subarray(pos),
        ]);

        assert.equal(
          (await subir(
            c.leccion,
            docente,
            exacto,
          )).status,
          200,
        );
      },
    );

    it(
      'reemplaza el PDF y elimina el anterior después de confirmar la asociación',
      async () => {
        const c = await escenario();

        const primero = await subir(c.leccion);

        const archivo =
          primero.json.modulos[0].lecciones[0].archivo;

        const anterior = await rutaArchivo(archivo.id);

        const segundo = await subir(
          c.leccion,
          docente,
          pdf,
          'reemplazo.pdf',
        );

        assert.equal(segundo.status, 200);

        assert.notEqual(
          segundo.json.modulos[0].lecciones[0].archivo.id,
          archivo.id,
        );

        assert.equal(
          segundo.json.modulos[0].lecciones[0].archivo.nombreOriginal,
          'reemplazo.pdf',
        );

        assert.equal(
          (await pool.query(
            'SELECT 1 FROM archivo WHERE id_archivo = $1',
            [archivo.id],
          )).rowCount,
          0,
        );

        await assert.rejects(
          readFile(path.join(carpeta, anterior)),
          { code: 'ENOENT' },
        );
      },
    );

    it(
      'conserva el PDF anterior y revierte metadatos si falla la asociación',
      async () => {
        const c = await escenario();

        const original = await subir(c.leccion);

        const archivo =
          original.json.modulos[0].lecciones[0].archivo;

        const ficheros = (await readdir(carpeta)).sort();

        const asociar = cursosService.asociarPdfPrincipal;

        cursosService.asociarPdfPrincipal = async () => {
          throw new Error('fallo simulado de asociación');
        };

        try {
          const r = await subir(c.leccion);

          assert.equal(r.status, 500);
          assert.equal(r.json.error.codigo, 'ERROR_INTERNO');

          assert.ok(
            !JSON.stringify(r.json).includes(carpeta),
          );
        } finally {
          cursosService.asociarPdfPrincipal = asociar;
        }

        const guardado = await pool.query<{ id: number }>(
          `
            SELECT id_archivo AS id
            FROM leccion
            WHERE id_leccion = $1
          `,
          [c.leccion],
        );

        assert.equal(
          guardado.rows[0]!.id,
          archivo.id,
        );

        assert.deepEqual(
          (await readdir(carpeta)).sort(),
          ficheros,
        );

        assert.deepEqual(
          await almacenLocal.leer(
            await rutaArchivo(archivo.id),
            archivo.tamanoBytes,
          ),
          pdf,
        );
      },
    );

    it(
      'revierte una escritura fallida y reintenta una limpieza fallida sin perder el reemplazo',
      async () => {
        const c = await escenario();

        const guardar = almacenLocal.guardar;

        almacenLocal.guardar = async () => {
          throw new Error('sin espacio');
        };

        try {
          assert.equal(
            (await subir(c.leccion)).status,
            500,
          );
        } finally {
          almacenLocal.guardar = guardar;
        }

        const primero = await subir(c.leccion);

        const anterior = await rutaArchivo(
          primero.json.modulos[0].lecciones[0].archivo.id,
        );

        const eliminar = almacenLocal.eliminar;

        almacenLocal.eliminar = async () => {
          throw new Error(
            'limpieza temporalmente bloqueada',
          );
        };

        try {
          assert.equal(
            (await subir(c.leccion)).status,
            200,
          );
        } finally {
          almacenLocal.eliminar = eliminar;
        }

        assert.equal(
          (await pool.query(
            `
              SELECT 1
              FROM archivo_borrado_pendiente
              WHERE nombre = $1
            `,
            [anterior],
          )).rowCount,
          1,
        );

        assert.deepEqual(
          await readFile(path.join(carpeta, anterior)),
          pdf,
        );

        await contenidoService.limpiarPendientes();

        await assert.rejects(
          readFile(path.join(carpeta, anterior)),
          { code: 'ENOENT' },
        );

        assert.equal(
          (await pool.query(
            `
              SELECT 1
              FROM archivo_borrado_pendiente
              WHERE nombre = $1
            `,
            [anterior],
          )).rowCount,
          0,
        );
      },
    );

    it(
      'rechaza con motivo, registra el revisor persona y permite refrescar un curso decidido',
      async () => {
        const c = await escenario('EN_REVISION');

        for (const cuerpo of [
          { decision: 'RECHAZAR' },
          { decision: 'RECHAZAR', motivo: ' ' },
          {
            decision: 'RECHAZAR',
            motivo: 'a'.repeat(301),
          },
          { decision: 'OTRA' },
        ]) {
          assert.equal(
            (await pedir(
              '/api/admin/cursos/' + c.id + '/revision',
              admin,
              'PUT',
              cuerpo,
            )).status,
            400,
          );
        }

        const r = await pedir(
          '/api/admin/cursos/' + c.id + '/revision',
          admin,
          'PUT',
          {
            decision: 'RECHAZAR',
            motivo: '  Mejora los ejemplos.  ',
          },
        );

        assert.equal(r.status, 200);
        assert.equal(r.json.estado, 'RECHAZADO');
        assert.equal(
          r.json.motivoRechazo,
          'Mejora los ejemplos.',
        );

        const fila = await pool.query<{
          revisado_por: number;
          publicado_en: Date | null;
        }>(
          `
            SELECT revisado_por, publicado_en
            FROM curso
            WHERE id_curso = $1
          `,
          [c.id],
        );

        assert.equal(
          fila.rows[0]!.revisado_por,
          admin.sesion.idPersona,
        );

        assert.equal(
          fila.rows[0]!.publicado_en,
          null,
        );

        assert.equal(
          (await pedir(
            '/api/admin/cursos/' + c.id,
          )).json.estado,
          'RECHAZADO',
        );

        assert.equal(
          (await pedir(
            '/api/cursos/' + c.id,
            null,
          )).status,
          404,
        );
      },
    );

    it(
      'revalida PDFs guardados al aprobar y publica en el catálogo existente',
      async () => {
        const c = await escenario('EN_REVISION');

        assert.equal(
          (await pedir(
            '/api/admin/cursos/' + c.id + '/revision',
            admin,
            'PUT',
            { decision: 'APROBAR' },
          )).status,
          409,
        );

        await pool.query(
          `
            UPDATE curso
            SET estado = 'BORRADOR'
            WHERE id_curso = $1
          `,
          [c.id],
        );

        const subida = await subir(c.leccion);

        const archivo =
          subida.json.modulos[0].lecciones[0].archivo;

        const ruta = path.join(
          carpeta,
          await rutaArchivo(archivo.id),
        );

        await pool.query(
          `
            UPDATE curso
            SET estado = 'EN_REVISION'
            WHERE id_curso = $1
          `,
          [c.id],
        );

        const corrupto = Buffer.from(pdf);
        corrupto.fill(32, 0, 8);

        await writeFile(ruta, corrupto);

        assert.equal(
          (await pedir(
            '/api/admin/cursos/' + c.id + '/revision',
            admin,
            'PUT',
            { decision: 'APROBAR' },
          )).status,
          409,
        );

        await writeFile(ruta, pdf);

        const r = await pedir(
          '/api/admin/cursos/' + c.id + '/revision',
          admin,
          'PUT',
          { decision: 'APROBAR' },
        );

        assert.equal(r.status, 200);
        assert.equal(r.json.estado, 'PUBLICADO');
        assert.equal(r.json.motivoRechazo, null);
        assert.equal(r.json.validacion.completo, true);

        assert.equal(
          (await pedir(
            '/api/cursos/' + c.id,
            null,
          )).status,
          200,
        );

        const fila = await pool.query(
          `
            SELECT publicado_en, revisado_por
            FROM curso
            WHERE id_curso = $1
          `,
          [c.id],
        );

        assert.ok(
          fila.rows[0].publicado_en instanceof Date,
        );

        assert.equal(
          fila.rows[0].revisado_por,
          admin.sesion.idPersona,
        );

        assert.equal(
          (await subir(c.leccion)).status,
          409,
        );
      },
    );

    it(
      'solo admite una decisión cuando dos administradores deciden simultáneamente',
      async () => {
        const c = await escenario('EN_REVISION');

        const respuestas = await Promise.all(
          [admin, admin2].map(quien =>
            pedir(
              '/api/admin/cursos/' + c.id + '/revision',
              quien,
              'PUT',
              {
                decision: 'RECHAZAR',
                motivo: 'Revisar material.',
              },
            ),
          ),
        );

        assert.deepEqual(
          respuestas.map(r => r.status).sort(),
          [200, 409],
        );

        assert.equal(
          (await pedir(
            '/api/admin/cursos/' + c.id,
          )).json.estado,
          'RECHAZADO',
        );
      },
    );

    it(
      'vuelve a comprobar el estado dentro de la transacción de subida',
      async () => {
        const c = await escenario();

        await contenidoService.verificarCarga(
          c.leccion,
          docente.sesion,
        );

        await pool.query(
          `
            UPDATE curso
            SET estado = 'EN_REVISION'
            WHERE id_curso = $1
          `,
          [c.id],
        );

        await assert.rejects(
          contenidoService.subir(
            c.leccion,
            {
              originalname: 'leccion.pdf',
              buffer: pdf,
            },
            docente.sesion,
          ),
          (error: any) => error.status === 409,
        );

        const { rows } = await pool.query(
          `
            SELECT id_archivo
            FROM leccion
            WHERE id_leccion = $1
          `,
          [c.leccion],
        );

        assert.equal(rows[0].id_archivo, null);
      },
    );

    it(
      'la aprobación comprueba también los datos del curso y el mínimo de objetivos',
      async () => {
        const c = await escenario();

        assert.equal(
          (await subir(c.leccion)).status,
          200,
        );

        await pool.query(
          `
            UPDATE curso
            SET
              estado = 'EN_REVISION',
              descripcion = '',
              objetivos = $2,
              portada_url = $3
            WHERE id_curso = $1
          `,
          [
            c.id,
            ['Solo un objetivo'],
            'C:\\archivos\\portada.jpg',
          ],
        );

        const r = await pedir(
          '/api/admin/cursos/' + c.id + '/revision',
          admin,
          'PUT',
          { decision: 'APROBAR' },
        );

        assert.equal(r.status, 409);

        for (const campo of [
          'descripcion',
          'objetivos',
          'portadaUrl',
        ]) {
          assert.ok(
            r.json.error.detalles.some(
              (d: any) => d.campo === campo,
            ),
          );
        }

        assert.equal(
          (await pedir(
            '/api/admin/cursos/' + c.id,
          )).json.estado,
          'EN_REVISION',
        );
      },
    );

    it(
      'rechaza rutas físicas manipuladas y no permite aprobar una categoría inactiva',
      async () => {
        const c = await escenario();
        const subida = await subir(c.leccion);

        const id =
          subida.json.modulos[0].lecciones[0].archivo.id;

        const original = await rutaArchivo(id);

        await pool.query(
          `
            UPDATE archivo
            SET ruta = '../archivo-privado.pdf'
            WHERE id_archivo = $1
          `,
          [id],
        );

        assert.equal(
          (await pedir(
            '/api/archivos/' + id,
            docente,
          )).status,
          404,
        );

        await pool.query(
          `
            UPDATE archivo
            SET ruta = $2
            WHERE id_archivo = $1
          `,
          [id, original],
        );

        await pool.query(
          `
            UPDATE curso
            SET estado = 'EN_REVISION'
            WHERE id_curso = $1
          `,
          [c.id],
        );

        await pool.query(
          `
            UPDATE categoria
            SET activa = false
            WHERE id_categoria = $1
          `,
          [categoriaId],
        );

        try {
          const r = await pedir(
            '/api/admin/cursos/' + c.id + '/revision',
            admin,
            'PUT',
            { decision: 'APROBAR' },
          );

          assert.equal(r.status, 409);

          assert.ok(
            r.json.error.detalles.some(
              (d: any) => d.campo === 'categoriaId',
            ),
          );
        } finally {
          await pool.query(
            `
              UPDATE categoria
              SET activa = true
              WHERE id_categoria = $1
            `,
            [categoriaId],
          );
        }
      },
    );

    it(
      'ofrece al integrante 2 una limpieza transaccional después de borrar una lección',
      async () => {
        const c = await escenario();
        const subida = await subir(c.leccion);

        const id =
          subida.json.modulos[0].lecciones[0].archivo.id;

        const nombre = await rutaArchivo(id);

        await enTransaccion(async cliente => {
          await cliente.query(
            `
              SELECT id_curso
              FROM curso
              WHERE id_curso = $1
              FOR UPDATE
            `,
            [c.id],
          );

          await limpiezaPdfService.retirarPdfSinUso(
            cliente,
            c.id,
            [id],
          );
        });

        assert.equal(
          (await pool.query(
            'SELECT 1 FROM archivo WHERE id_archivo = $1',
            [id],
          )).rowCount,
          1,
        );

        await enTransaccion(async cliente => {
          await cliente.query(
            `
              SELECT id_curso
              FROM curso
              WHERE id_curso = $1
              FOR UPDATE
            `,
            [c.id],
          );

          await cliente.query(
            'DELETE FROM leccion WHERE id_leccion = $1',
            [c.leccion],
          );

          await limpiezaPdfService.retirarPdfSinUso(
            cliente,
            c.id,
            [id],
          );
        });

        assert.equal(
          (await pool.query(
            'SELECT 1 FROM archivo WHERE id_archivo = $1',
            [id],
          )).rowCount,
          0,
        );

        assert.deepEqual(
          await readFile(path.join(carpeta, nombre)),
          pdf,
        );

        await limpiezaPdfService.limpiarPendientes();

        await assert.rejects(
          readFile(path.join(carpeta, nombre)),
          { code: 'ENOENT' },
        );
      },
    );
  },
);