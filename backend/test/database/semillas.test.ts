// Comprueba el SQL de las semillas (semillas.repository.ts) dentro de una transacción que siempre se
// deshace: no deja ninguna fila en learnity_test.
import '../ayudas/guardia-bd.js';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { verificarBaseConectada } from '../ayudas/guardia-bd.js';

const { pool, enTransaccion } = await import('../../src/shared/database/pool.js');
const { semillasRepository: repo } = await import('../../src/database/semillas.repository.js');

const marca = 'sem_' + randomUUID().slice(0, 8);
const DESHACER = new Error('deshacer la transacción de prueba');

describe('semillas.repository', () => {
  before(async () => {
    await verificarBaseConectada(pool);
  });

  after(async () => {
    await pool.end();
  });

  it('crea cuentas, docente, categoría y un curso PUBLICADO con revisor, y todo se deshace', async () => {
    await assert.rejects(
      enTransaccion(async (cliente) => {
        const rolEstudiante = await repo.idRol(cliente, 'ESTUDIANTE');
        assert.ok(rolEstudiante, 'la base de pruebas debe tener el rol ESTUDIANTE');
        assert.equal(await repo.idRol(cliente, 'NO_EXISTE'), null);

        const admin = await repo.crearPersonaYUsuario(cliente, {
          nombres: marca, apellidos: 'Admin', ciudad: 'Machala', biografia: null,
          correo: `${marca}.admin@pruebas.test`, contrasenaHash: 'hash-de-prueba',
        });
        await repo.asignarRol(cliente, admin.idUsuario, rolEstudiante, null);
        assert.equal(await repo.idPersonaPorCorreo(cliente, `${marca}.admin@pruebas.test`), admin.idPersona);
        assert.equal(await repo.idPersonaPorCorreo(cliente, `${marca}.nadie@pruebas.test`), null);

        const profe = await repo.crearPersonaYUsuario(cliente, {
          nombres: marca, apellidos: 'Docente', ciudad: 'Machala', biografia: 'Bio',
          correo: `${marca}.docente@pruebas.test`, contrasenaHash: 'hash-de-prueba',
        });
        await repo.crearSolicitudDocenteAprobada(cliente, profe.idPersona, 'Prueba', 'Motivo de prueba suficiente', admin.idPersona);
        await repo.crearDocente(cliente, profe.idPersona, 'Prueba');
        const idDocente = await repo.idDocentePorCorreo(cliente, `${marca}.docente@pruebas.test`);
        assert.ok(idDocente);

        assert.equal(await repo.crearCategoriaSiFalta(cliente, { nombre: marca, descripcion: 'd', activa: true }, admin.idPersona), true);
        assert.equal(await repo.crearCategoriaSiFalta(cliente, { nombre: marca, descripcion: 'd', activa: true }, admin.idPersona), false);
        const idCategoria = await repo.idCategoriaActiva(cliente, marca);
        assert.ok(idCategoria);

        assert.equal(await repo.existeCurso(cliente, idDocente, `${marca} curso`), false);
        const idCurso = await repo.crearCurso(cliente, {
          idDocente, idCategoria, titulo: `${marca} curso`, subtitulo: 's', descripcion: 'd', nivel: 'PRINCIPIANTE',
          objetivos: ['a', 'b', 'c'], requisitos: ['Ninguno'], estado: 'PUBLICADO',
          revisadoPor: admin.idPersona, publicadoEn: new Date(),
        });
        assert.equal(await repo.existeCurso(cliente, idDocente, `${marca} curso`), true);
        const idModulo = await repo.crearModulo(cliente, idCurso, 'Primer módulo', 1);
        await repo.crearLeccionDocumento(cliente, idModulo, 'Lección de ejemplo', 1);

        const { rows } = await cliente.query('SELECT revisado_por, publicado_en FROM curso WHERE id_curso = $1', [idCurso]);
        assert.equal(rows[0].revisado_por, admin.idPersona);
        assert.ok(rows[0].publicado_en);

        throw DESHACER;
      }),
      (error) => error === DESHACER,
    );

    const { rows } = await pool.query('SELECT 1 FROM persona WHERE nombres = $1', [marca]);
    assert.equal(rows.length, 0, 'la transacción de prueba no debe dejar filas');
  });
});
