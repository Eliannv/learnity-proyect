/**
 * Datos iniciales de desarrollo: una cuenta por cada tipo de usuario y las categorías del catálogo.
 * Ejecutar con:  npm run db:seed
 *
 * - Es idempotente: si una cuenta o categoría ya existe, la deja como está.
 * - Usa la cuenta del backend (learnity_app), que solo inserta datos; no crea tablas.
 * - Requiere que la base ya tenga las 19 tablas y los roles ESTUDIANTE, DOCENTE y ADMIN.
 */
import 'dotenv/config';
import type pg from 'pg';
import { enTransaccion, pool } from '../shared/database/pool.js';
import { cifrarContrasena } from '../shared/auth/contrasena.js';
import { env } from '../shared/config/env.js';
import type { Rol } from '../shared/auth/tipos.js';

interface CuentaSemilla {
  nombres: string;
  apellidos: string;
  correo: string;
  ciudad: string;
  biografia?: string;
  roles: Rol[];
  docente?: { especialidad: string; motivo: string };
}

const CUENTAS: CuentaSemilla[] = [
  {
    nombres: 'Ana',
    apellidos: 'Torres',
    correo: 'ana.torres@learnity.com',
    ciudad: 'Machala',
    roles: ['ESTUDIANTE', 'ADMIN'],
  },
  {
    nombres: 'Carlos',
    apellidos: 'Mendoza Ruiz',
    correo: 'carlos.mendoza@correo.com',
    ciudad: 'Machala',
    biografia: 'Ingeniero de software con 8 años de experiencia. Enseño programación desde 2018.',
    roles: ['ESTUDIANTE', 'DOCENTE'],
    docente: {
      especialidad: 'Programación y desarrollo web',
      motivo:
        'Soy ingeniero de software y quiero publicar cursos cortos de programación para principiantes con videos y evaluaciones.',
    },
  },
  {
    nombres: 'Rosa',
    apellidos: 'Vera Chávez',
    correo: 'rosa.vera@correo.com',
    ciudad: 'Machala',
    roles: ['ESTUDIANTE'],
  },
];

const CATEGORIAS: { nombre: string; descripcion: string; activa: boolean }[] = [
  { nombre: 'Programación', descripcion: 'Lenguajes, desarrollo web y lógica de programación.', activa: true },
  { nombre: 'Diseño', descripcion: 'Diseño gráfico, UX y herramientas de diseño.', activa: true },
  { nombre: 'Idiomas', descripcion: 'Cursos de idiomas para principiantes.', activa: true },
  { nombre: 'Negocios', descripcion: 'Emprendimiento y gestión.', activa: true },
  { nombre: 'Marketing', descripcion: 'Marketing digital y redes sociales.', activa: true },
  { nombre: 'Ofimática', descripcion: 'Hojas de cálculo, documentos y presentaciones.', activa: false },
];

async function idRol(cliente: pg.PoolClient, rol: Rol): Promise<number> {
  const { rows } = await cliente.query<{ id_rol: number }>('SELECT id_rol FROM rol WHERE nombre = $1', [rol]);
  if (!rows[0]) throw new Error(`Falta el rol ${rol}. Ejecuta primero el script 10_roles_learnity.sql de la guía.`);
  return rows[0].id_rol;
}

async function crearCuenta(cliente: pg.PoolClient, cuenta: CuentaSemilla, hash: string, idAdmin: number | null) {
  const existe = await cliente.query<{ id_persona: number }>('SELECT id_persona FROM usuario WHERE correo = $1', [cuenta.correo]);
  if (existe.rows[0]) {
    console.log(`  = ${cuenta.correo} ya existe (sin cambios)`);
    return existe.rows[0].id_persona;
  }

  const persona = await cliente.query<{ id_persona: number }>(
    'INSERT INTO persona (nombres, apellidos, ciudad, biografia) VALUES ($1, $2, $3, $4) RETURNING id_persona',
    [cuenta.nombres, cuenta.apellidos, cuenta.ciudad, cuenta.biografia ?? null],
  );
  const idPersona = persona.rows[0]!.id_persona;
  const usuario = await cliente.query<{ id_usuario: number }>(
    'INSERT INTO usuario (id_persona, correo, contrasena_hash) VALUES ($1, $2, $3) RETURNING id_usuario',
    [idPersona, cuenta.correo, hash],
  );
  const idUsuario = usuario.rows[0]!.id_usuario;

  for (const rol of cuenta.roles) {
    // ESTUDIANTE se asigna al registrarse (sin asignado_por); los demás los otorga el administrador.
    const asignadoPor = rol === 'ESTUDIANTE' ? null : (idAdmin ?? idPersona);
    await cliente.query('INSERT INTO usuario_rol (id_usuario, id_rol, asignado_por) VALUES ($1, $2, $3)', [
      idUsuario,
      await idRol(cliente, rol),
      asignadoPor,
    ]);
  }

  if (cuenta.docente) {
    // Flujo real: solicitud aprobada por el administrador → perfil docente.
    await cliente.query(
      `INSERT INTO solicitud_docente (id_persona, especialidad, motivo, estado, revisada_por, revisada_en)
       VALUES ($1, $2, $3, 'APROBADA', $4, now())`,
      [idPersona, cuenta.docente.especialidad, cuenta.docente.motivo, idAdmin],
    );
    await cliente.query('INSERT INTO docente (id_persona, especialidad) VALUES ($1, $2)', [
      idPersona,
      cuenta.docente.especialidad,
    ]);
  }

  console.log(`  + ${cuenta.correo} (${cuenta.roles.join(', ')})`);
  return idPersona;
}

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('El seed de cuentas de prueba no debe ejecutarse en producción.');
  }
  const contrasena = process.env.SEED_PASSWORD ?? 'Learnity2026!';
  const hash = await cifrarContrasena(contrasena);

  await enTransaccion(async (cliente) => {
    console.log('Cuentas de prueba:');
    // El administrador va primero: los demás registros guardan quién los aprobó.
    const idAdmin = await crearCuenta(cliente, CUENTAS[0]!, hash, null);
    for (const cuenta of CUENTAS.slice(1)) {
      await crearCuenta(cliente, cuenta, hash, idAdmin);
    }

    console.log('Categorías:');
    for (const c of CATEGORIAS) {
      const r = await cliente.query(
        `INSERT INTO categoria (nombre, descripcion, activa, creada_por)
         VALUES ($1, $2, $3, $4) ON CONFLICT (nombre) DO NOTHING`,
        [c.nombre, c.descripcion, c.activa, idAdmin],
      );
      console.log(`  ${r.rowCount ? '+' : '='} ${c.nombre}`);
    }
  });

  console.log(`\nListo. Contraseña de las cuentas de prueba: ${contrasena}`);
}

main()
  .catch((error) => {
    console.error('\nNo se pudo cargar el seed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
