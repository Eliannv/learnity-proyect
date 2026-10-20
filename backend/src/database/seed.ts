/**
 * Datos iniciales de desarrollo: una cuenta por cada tipo de usuario y las categorías del catálogo.
 * Ejecutar con:  npm run db:seed
 *
 * - Es idempotente: si una cuenta o categoría ya existe, la deja como está.
 * - Usa la cuenta del backend (learnity_app), que solo inserta datos; no crea tablas.
 * - Requiere que la base ya tenga las 19 tablas y los roles ESTUDIANTE, DOCENTE y ADMIN.
 */
import 'dotenv/config';
import { enTransaccion, pool, type Ejecutor } from '../shared/database/pool.js';
import { semillasRepository } from './semillas.repository.js';
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

async function idRol(cliente: Ejecutor, rol: Rol): Promise<number> {
  const id = await semillasRepository.idRol(cliente, rol);
  if (id === null) throw new Error(`Falta el rol ${rol}. Ejecuta primero el script 10_roles_learnity.sql de la guía.`);
  return id;
}

async function crearCuenta(cliente: Ejecutor, cuenta: CuentaSemilla, hash: string, idAdmin: number | null) {
  const existente = await semillasRepository.idPersonaPorCorreo(cliente, cuenta.correo);
  if (existente !== null) {
    console.log(`  = ${cuenta.correo} ya existe (sin cambios)`);
    return existente;
  }

  const { idPersona, idUsuario } = await semillasRepository.crearPersonaYUsuario(cliente, {
    nombres: cuenta.nombres,
    apellidos: cuenta.apellidos,
    ciudad: cuenta.ciudad,
    biografia: cuenta.biografia ?? null,
    correo: cuenta.correo,
    contrasenaHash: hash,
  });

  for (const rol of cuenta.roles) {
    // ESTUDIANTE se asigna al registrarse (sin asignado_por); los demás los otorga el administrador.
    const asignadoPor = rol === 'ESTUDIANTE' ? null : (idAdmin ?? idPersona);
    await semillasRepository.asignarRol(cliente, idUsuario, await idRol(cliente, rol), asignadoPor);
  }

  if (cuenta.docente) {
    // Flujo real: solicitud aprobada por el administrador → perfil docente.
    await semillasRepository.crearSolicitudDocenteAprobada(
      cliente,
      idPersona,
      cuenta.docente.especialidad,
      cuenta.docente.motivo,
      idAdmin,
    );
    await semillasRepository.crearDocente(cliente, idPersona, cuenta.docente.especialidad);
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
      const creada = await semillasRepository.crearCategoriaSiFalta(cliente, c, idAdmin);
      console.log(`  ${creada ? '+' : '='} ${c.nombre}`);
    }
  });

  // No se imprime la contraseña (S8): se fija con SEED_PASSWORD; sin ella rige la predeterminada del script.
  console.log('\nListo. Las cuentas de prueba usan la contraseña de SEED_PASSWORD (o la predeterminada del script).');
}

main()
  .catch((error) => {
    console.error('\nNo se pudo cargar el seed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
