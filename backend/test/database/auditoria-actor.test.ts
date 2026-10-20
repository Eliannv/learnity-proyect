// El actor de la auditoría (migración 020): una operación autenticada deja `id_persona_actor` igual a la
// persona que la hizo. `auditoria_cambio` solo se lee con el rol de pruebas, por eso se consulta con fixtures.
import '../ayudas/guardia-bd.js';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { Rol, UsuarioSesion } from '../../src/shared/auth/tipos.js';

const { pool } = await import('../../src/shared/database/pool.js');
const { crearFixtures } = await import('../ayudas/bd-fixtures.js');
const { cursosService: cursosApi } = await import('../../src/modules/cursos/cursos.service.js');
const { usuariosService } = await import('../../src/modules/usuarios/usuarios.service.js');

const marca = 'au_' + randomUUID().slice(0, 8);
let f: Awaited<ReturnType<typeof crearFixtures>>;
let idCategoria: number;
const personas: number[] = [];

async function sesion(roles: Rol[], conDocente: boolean): Promise<UsuarioSesion> {
  const p = await f.query<{ id: number }>(
    'INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona AS id',
    [marca, roles.join(' ')],
  );
  const idPersona = p.rows[0]!.id;
  personas.push(idPersona);
  const correo = `${marca}_${idPersona}@pruebas.test`;
  const u = await f.query<{ id: number }>(
    'INSERT INTO usuario (id_persona, correo, contrasena_hash) VALUES ($1, $2, $3) RETURNING id_usuario AS id',
    [idPersona, correo, 'x'.repeat(60)],
  );
  const idUsuario = u.rows[0]!.id;
  await f.query(
    'INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id_rol FROM rol WHERE nombre = ANY($2::text[])',
    [idUsuario, roles],
  );
  if (conDocente) {
    await f.query("INSERT INTO docente (id_persona, especialidad) VALUES ($1, 'Pruebas')", [idPersona]);
  }
  return { idUsuario, idPersona, correo, roles, sid: randomUUID() };
}

async function actoresDe(tabla: string, columnaId: string, id: number, operacion: string): Promise<(number | null)[]> {
  const { rows } = await f.query<{ actor: number | null }>(
    `SELECT id_persona_actor AS actor FROM auditoria_cambio
      WHERE tabla = $1 AND operacion = $2 AND COALESCE(despues, antes)->>$3 = $4`,
    [tabla, operacion, columnaId, String(id)],
  );
  return rows.map((r) => r.actor);
}

before(async () => {
  f = await crearFixtures();
  const admin = await sesion(['ESTUDIANTE', 'ADMIN'], false);
  const c = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  idCategoria = c.rows[0]!.id;
});

after(async () => {
  if (personas.length) {
    await f.query(
      `DELETE FROM modulo WHERE id_curso IN (SELECT c.id_curso FROM curso c JOIN docente d ON d.id_docente = c.id_docente
                                              WHERE d.id_persona = ANY($1::int[]))`,
      [personas],
    );
    await f.query(
      `DELETE FROM curso WHERE id_docente IN (SELECT id_docente FROM docente WHERE id_persona = ANY($1::int[]))`,
      [personas],
    );
    await f.query('DELETE FROM categoria WHERE id_categoria = $1', [idCategoria]);
    await f.query('DELETE FROM solicitud_docente WHERE id_persona = ANY($1::int[])', [personas]);
    await f.query('DELETE FROM docente WHERE id_persona = ANY($1::int[])', [personas]);
    await f.query('DELETE FROM usuario WHERE id_persona = ANY($1::int[])', [personas]);
    await f.query('DELETE FROM persona WHERE id_persona = ANY($1::int[])', [personas]);
  }
  await f.cerrar();
  await pool.end();
});

describe('Actor de la auditoría en operaciones autenticadas', () => {
  it('crear un curso y un módulo deja como actor a la persona del docente', async () => {
    const docente = await sesion(['ESTUDIANTE', 'DOCENTE'], true);
    const curso = await cursosApi.crearCurso(
      {
        titulo: marca,
        subtitulo: 'Auditoría',
        descripcion: 'Prueba del actor de auditoría',
        categoriaId: idCategoria,
        nivel: 'PRINCIPIANTE',
        portadaUrl: '/img/portada.jpg',
        objetivos: ['Uno', 'Dos', 'Tres'],
        requisitos: [],
      },
      docente,
    );
    assert.deepEqual(await actoresDe('curso', 'id_curso', curso.id, 'INSERT'), [docente.idPersona]);

    const conModulo = await cursosApi.crearModulo(curso.id, { titulo: 'Módulo', orden: 1 }, docente);
    const idModulo = conModulo.modulos[0]!.id;
    assert.deepEqual(await actoresDe('modulo', 'id_modulo', idModulo, 'INSERT'), [docente.idPersona]);

    await cursosApi.eliminarModulo(idModulo, docente);
    assert.deepEqual(await actoresDe('modulo', 'id_modulo', idModulo, 'DELETE'), [docente.idPersona]);
  });

  it('solicitar la docencia deja como actor al estudiante', async () => {
    const estudiante = await sesion(['ESTUDIANTE'], false);
    const solicitud = await usuariosService.solicitarDocencia(estudiante, {
      especialidad: 'Programación web',
      motivo: 'Enseño programación web desde hace cinco años y quiero publicar un curso para principiantes.',
    });
    assert.deepEqual(await actoresDe('solicitud_docente', 'id_solicitud', solicitud.id, 'INSERT'), [estudiante.idPersona]);
  });
});
