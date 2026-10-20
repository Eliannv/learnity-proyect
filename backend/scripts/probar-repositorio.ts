// Prueba rápida del repositorio de Identidad contra la base configurada en .env:
//   npx tsx scripts/probar-repositorio.ts
// Verifica que las cuentas del seed existen, con sus roles, y que la contraseña coincide con el hash.
import { identidadRepository } from '../src/modules/identidad/identidad.repository.js';
import { compararContrasena } from '../src/shared/auth/contrasena.js';
import { pool } from '../src/shared/database/pool.js';

const contrasena = process.env.SEED_PASSWORD;
if (!contrasena) {
  throw new Error('Configura SEED_PASSWORD antes de comprobar las cuentas de prueba.');
}
let fallas = 0;

for (const correo of ['ana.torres@learnity.com', 'carlos.mendoza@correo.com', 'rosa.vera@correo.com']) {
  const cuenta = await identidadRepository.buscarCuentaPorCorreo(correo);
  if (!cuenta) {
    console.log(`✗ ${correo}: no existe (¿ejecutaste npm run db:seed?)`);
    fallas++;
    continue;
  }
  const ok = await compararContrasena(contrasena, cuenta.contrasenaHash);
  const perfil = await identidadRepository.obtenerPerfil(cuenta.idUsuario);
  console.log(
    `${ok ? '✓' : '✗'} ${correo} · ${cuenta.nombres} ${cuenta.apellidos} · roles: ${cuenta.roles.join(', ')} · ` +
      `contraseña ${ok ? 'correcta' : 'NO coincide'} · perfil: ${perfil ? 'ok' : 'falta'}`,
  );
  if (!ok || !perfil) fallas++;
}

await pool.end();
process.exitCode = fallas ? 1 : 0;
