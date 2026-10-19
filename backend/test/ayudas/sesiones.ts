// Cuentas de prueba por rol y limpieza por marca. Fixtures por SQL + login real por HTTP.
// Cada persona lleva nombres = marca (así la limpieza encuentra todo lo de la suite).
// El hash se genera con bcrypt directo (coste bajo): la app lo verifica con bcrypt.compare.
import bcrypt from 'bcrypt';
import type { Fixtures } from './bd-fixtures.js';
import { CONTRASENA_PRUEBA, generadorCorreos } from './datos.js';
import type { Servidor } from './servidor.js';

export type RolPrueba = 'ESTUDIANTE' | 'DOCENTE' | 'ADMIN';

export interface Cuenta {
  idPersona: number;
  idUsuario: number;
  idDocente: number | null;
  correo: string;
  roles: RolPrueba[];
  token: string;
}

const hash = bcrypt.hashSync(CONTRASENA_PRUEBA, 4);

/** Login real por HTTP; devuelve el access token. Ojo con el límite de 20 logins por IP cada 15 min. */
export async function iniciarSesion(srv: Servidor, correo: string, contrasena = CONTRASENA_PRUEBA): Promise<string> {
  const r = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena } });
  if (r.status !== 200) throw new Error(`Login de fixture falló (${r.status}): ${r.texto.slice(0, 200)}`);
  return r.json.accessToken as string;
}

export function fabricaCuentas(f: Fixtures, srv: Servidor, marca: string) {
  const correo = generadorCorreos(marca);

  /** `roles` exacto (p. ej. ['DOCENTE'] sin ESTUDIANTE para C-03). `docente` crea la fila de docente. */
  async function crearCuenta(
    roles: RolPrueba[],
    opciones: { docente?: boolean; activo?: boolean; correo?: string; sinSesion?: boolean } = {},
  ): Promise<Cuenta> {
    const etiqueta = roles.join('-').toLowerCase();
    const { rows: [p] } = await f.query<{ id: number }>(
      'INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona AS id', [marca, etiqueta]);
    const mail = opciones.correo ?? correo(etiqueta);
    const { rows: [u] } = await f.query<{ id: number }>(
      'INSERT INTO usuario (id_persona, correo, contrasena_hash, estado) VALUES ($1, $2, $3, $4) RETURNING id_usuario AS id',
      [p!.id, mail, hash, opciones.activo === false ? 'INACTIVO' : 'ACTIVO']);
    await f.query(
      'INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id_rol FROM rol WHERE nombre = ANY($2::text[])', [u!.id, roles]);
    let idDocente: number | null = null;
    if (opciones.docente ?? roles.includes('DOCENTE')) {
      const { rows: [d] } = await f.query<{ id: number }>(
        "INSERT INTO docente (id_persona, especialidad) VALUES ($1, 'Pruebas') RETURNING id_docente AS id", [p!.id]);
      idDocente = d!.id;
    }
    const cuenta: Cuenta = { idPersona: p!.id, idUsuario: u!.id, idDocente, correo: mail, roles, token: '' };
    if (opciones.activo !== false && !opciones.sinSesion) cuenta.token = await iniciarSesion(srv, mail);
    return cuenta;
  }

  return { crearCuenta, correo };
}

/** Borra todo lo creado por una suite: cursos, categorías, solicitudes y cuentas con persona.nombres = marca. */
export async function limpiarMarca(f: Fixtures, marca: string): Promise<void> {
  const sub = '(SELECT id_persona FROM persona WHERE nombres = $1)';
  await f.query(
    `DELETE FROM curso WHERE id_docente IN (SELECT id_docente FROM docente WHERE id_persona IN ${sub}) OR revisado_por IN ${sub}`, [marca]);
  await f.query("DELETE FROM curso WHERE titulo LIKE $1 || '%'", [marca]);
  await f.query(`DELETE FROM categoria WHERE nombre LIKE $1 || '%' OR creada_por IN ${sub}`, [marca]);
  await f.query(`DELETE FROM solicitud_docente WHERE id_persona IN ${sub} OR revisada_por IN ${sub}`, [marca]);
  await f.query(`UPDATE usuario_rol SET asignado_por = NULL WHERE asignado_por IN ${sub}`, [marca]);
  await f.query(`DELETE FROM usuario WHERE id_persona IN ${sub}`, [marca]);
  await f.query(`DELETE FROM docente WHERE id_persona IN ${sub}`, [marca]);
  await f.query('DELETE FROM persona WHERE nombres = $1', [marca]);
}
