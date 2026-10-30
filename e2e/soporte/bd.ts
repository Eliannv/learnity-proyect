// Fixtures de base de datos para las E2E: reutiliza los de backend/test/ayudas (guarda *_test incluida).
import { crearFixtures, type Fixtures } from '../../backend/test/ayudas/bd-fixtures.js';
import { CONTRASENA_PRUEBA } from '../../backend/test/ayudas/datos.js';
import { fabricaCuentas, type Cuenta, type RolPrueba } from '../../backend/test/ayudas/sesiones.js';
import type { Servidor } from '../../backend/test/ayudas/servidor.js';

export { CONTRASENA_PRUEBA };

/** Marca de la ejecución (la fija playwright.config.ts). Todo lo creado la lleva para poder limpiarlo. */
export const MARCA = process.env['E2E_MARCA'] ?? 'e2e_sin_marca';

/** Abre un pool de fixtures, ejecuta el trabajo y lo cierra. */
export async function conFixtures<T>(trabajo: (f: Fixtures) => Promise<T>): Promise<T> {
  const f = await crearFixtures();
  try {
    return await trabajo(f);
  } finally {
    await f.cerrar();
  }
}

let contador = 0;

/** Cuenta con roles exactos, creada por SQL (sin sesión: la sesión se abre desde la interfaz). */
export async function crearCuenta(roles: RolPrueba[], etiqueta: string): Promise<Cuenta> {
  return conFixtures((f) => {
    const { crearCuenta: crear } = fabricaCuentas(f, {} as Servidor, MARCA);
    // La marca ya identifica al grupo; el contador evita choques entre llamadas del mismo rol.
    const correo = `${MARCA}.${etiqueta}${++contador}x${Math.random().toString(36).slice(2, 7)}@qa-edge.test`.toLowerCase();
    return crear(roles, { correo, sinSesion: true });
  });
}

/** Categoría activa para el selector del docente. Devuelve su nombre visible. */
export async function crearCategoria(idPersonaAdmin: number, nombre: string): Promise<string> {
  const completo = `${MARCA} ${nombre}`;
  await conFixtures((f) =>
    f.query('INSERT INTO categoria (nombre, activa, creada_por) VALUES ($1, true, $2)', [completo, idPersonaAdmin]),
  );
  return completo;
}

/** Cuenta de pruebas pendiente de residuos: cuenta de filas con la marca (para el informe final). */
export async function residuos(): Promise<Record<string, number>> {
  return conFixtures(async (f) => {
    const sub = '(SELECT id_persona FROM persona WHERE nombres = $1)';
    const consultas: Record<string, string> = {
      persona: 'SELECT count(*) n FROM persona WHERE nombres = $1',
      usuario: `SELECT count(*) n FROM usuario WHERE id_persona IN ${sub}`,
      curso: "SELECT count(*) n FROM curso WHERE titulo LIKE $1 || '%'",
      inscripcion: `SELECT count(*) n FROM inscripcion i JOIN curso c ON c.id_curso = i.id_curso
        WHERE c.titulo LIKE $1 || '%' OR i.id_persona IN ${sub}`,
      progreso_leccion: `SELECT count(*) n FROM progreso_leccion p
        JOIN inscripcion i ON i.id_inscripcion = p.id_inscripcion
        JOIN curso c ON c.id_curso = i.id_curso
        WHERE c.titulo LIKE $1 || '%' OR i.id_persona IN ${sub}`,
      categoria: "SELECT count(*) n FROM categoria WHERE nombre LIKE $1 || '%'",
      solicitud_docente: `SELECT count(*) n FROM solicitud_docente WHERE id_persona IN ${sub}`,
      evento_acceso: `SELECT count(*) n FROM evento_acceso
        WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE id_persona IN ${sub}) OR correo LIKE $1 || '%@qa-edge.test'`,
    };
    const salida: Record<string, number> = {};
    for (const [clave, sql] of Object.entries(consultas)) {
      const { rows } = await f.query<{ n: string }>(sql, [MARCA]);
      salida[clave] = Number(rows[0]?.n ?? 0);
    }
    return salida;
  });
}
