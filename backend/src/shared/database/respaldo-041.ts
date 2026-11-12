import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env } from '../config/env.js';
import { registrarEvento } from '../log/registro.js';
import { pool } from './pool.js';

/**
 * Respaldo de la migración 041 (hilos en reseñas, campos de perfil, cambio de correo y reportes de curso).
 *
 * Si la base no tiene la 041 completa, o la tiene pero `learnity_app` no puede escribir en ella (falta un
 * GRANT, RLS activado por Supabase, etc.), las operaciones de la 041 guardan sus datos en un JSON. El JSON
 * vive en la fila `sistema/respaldo-041.json` de `archivo_binario` (040), que sobrevive a los reinicios de
 * Render. Solo si esa tabla tampoco está disponible se usa un archivo en `os.tmpdir()`.
 *
 * El nombre de la fila no encaja con ningún patrón que se sirva públicamente (fotos: `fotos/<uuid>.<img>`,
 * almacén: `<uuid>.<pdf|ppt|pptx|zip>`), así que el JSON nunca sale por una ruta de descarga.
 */

let cacheTiene041: boolean | null = null;

export interface EjecutorConsulta041 {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parametros?: unknown[],
  ) => Promise<{ rows: T[] }>;
}

/**
 * La 041 solo cuenta como disponible si están todas sus piezas y `learnity_app` puede usarlas: las columnas
 * nuevas, la tabla `resena_respuesta` con SELECT/INSERT/UPDATE y sin RLS, y la función de reportes ejecutable.
 * Comprobar una sola columna de `persona` hacía que un INSERT sin permiso terminara en 500.
 */
export async function tieneMigracion041(ejecutor: EjecutorConsulta041): Promise<boolean> {
  if (cacheTiene041 !== null) return cacheTiene041;
  try {
    const { rows } = await ejecutor.query<{ ok: boolean | null }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'persona' AND column_name = 'pais')
          AND EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'token_recuperacion'
                          AND column_name = 'nuevo_correo')
          AND COALESCE(has_table_privilege(to_regclass('public.resena_respuesta'), 'SELECT, INSERT, UPDATE'), false)
          AND COALESCE((SELECT NOT c.relrowsecurity FROM pg_class c
                         WHERE c.oid = to_regclass('public.resena_respuesta')), false)
          AND COALESCE(has_function_privilege(
                to_regprocedure('public.registrar_reporte_curso(integer,integer,text)'), 'EXECUTE'), false)
          AS ok`,
    );
    cacheTiene041 = Boolean(rows[0]?.ok);
    if (!cacheTiene041) registrarEvento('bd.migracion_041_no_disponible', { motivo: 'deteccion' }, 'aviso');
    return cacheTiene041;
  } catch {
    return false;
  }
}

/** Errores que indican que la 041 falta o no es utilizable (tabla, columna, función o permiso/RLS). */
const CODIGOS_ESQUEMA_041 = new Set(['42P01', '42703', '42883', '42501']);

export function esFaltaMigracion041(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42703' || code === '42P01' || code === '42883' || code === '23514' || code === '22001';
}

function marcar041NoDisponible(error: unknown): void {
  cacheTiene041 = false;
  const e = error as { code?: string; message?: string } | null;
  registrarEvento('bd.migracion_041_no_disponible', { motivo: 'error', codigo: e?.code, mensaje: e?.message }, 'aviso');
}

export interface OpcionesCon041 {
  /** El ejecutor es el cliente de `enTransaccion`: se protege con un SAVEPOINT para no abortar la transacción. */
  transaccion?: boolean;
  /** Códigos extra que también se tratan como 041 incompleta (p. ej. el CHECK antiguo de `token_recuperacion`). */
  codigosExtra?: readonly string[];
}

/**
 * Ejecuta `conTablas` si la 041 está disponible y, si falla por esquema o permisos, vuelve a `respaldo`.
 * Dentro de una transacción, el intento va en `SAVEPOINT sp_041`: un error de PostgreSQL deja la transacción en
 * 25P02 y todas las consultas siguientes fallarían; con `ROLLBACK TO SAVEPOINT` la transacción sigue sana.
 */
export async function con041<T>(
  ejecutor: EjecutorConsulta041,
  conTablas: () => Promise<T>,
  respaldo: () => Promise<T>,
  opciones: OpcionesCon041 = {},
): Promise<T> {
  if (!(await tieneMigracion041(ejecutor))) return respaldo();
  if (opciones.transaccion) await ejecutor.query('SAVEPOINT sp_041');
  try {
    const valor = await conTablas();
    if (opciones.transaccion) await ejecutor.query('RELEASE SAVEPOINT sp_041');
    return valor;
  } catch (error) {
    if (opciones.transaccion) await ejecutor.query('ROLLBACK TO SAVEPOINT sp_041');
    const code = (error as { code?: string } | null)?.code ?? '';
    if (!CODIGOS_ESQUEMA_041.has(code) && !opciones.codigosExtra?.includes(code)) throw error;
    marcar041NoDisponible(error);
    return respaldo();
  }
}

export interface DatosExtraPersona041 {
  pais: string | null;
  provincia: string | null;
  fechaNacimiento: string | null;
}

export interface TokenCambioCorreo041 {
  idToken: string;
  idUsuario: number;
  tokenHash: string;
  nuevoCorreo: string;
  creadoEn: string;
  expiraEn: string;
  usadoEn: string | null;
}

export interface RespuestaResena041 {
  id: number;
  idResena: number;
  idPersona: number;
  comentario: string;
  creadoEn: string;
  eliminadoEn: string | null;
}

export interface ReporteCurso041 {
  idAlerta: number;
  idUsuario: number;
  correo: string;
  idCurso: number;
  cursoTitulo: string;
  motivo: string;
  clave: string;
  detectadaEn: string;
  atendidaEn: string | null;
  atendidaPor: number | null;
  atendidaPorNombre: string | null;
  nota: string | null;
}

export interface EstadoRespaldo041 {
  personas: Record<string, DatosExtraPersona041>;
  tokensCorreo: TokenCambioCorreo041[];
  secuenciaRespuesta: number;
  respuestasResena: RespuestaResena041[];
  secuenciaAlerta: number;
  reportesCurso: ReporteCurso041[];
}

/** Fila reservada de `archivo_binario`; ver la nota de seguridad al principio del archivo. */
export const NOMBRE_RESPALDO_041 = 'sistema/respaldo-041.json';

function rutaArchivo(): string {
  const base = (env.DB_NAME || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(os.tmpdir(), `learnity-respaldo-041-${base}.json`);
}

function estadoInicial(): EstadoRespaldo041 {
  return {
    personas: {},
    tokensCorreo: [],
    secuenciaRespuesta: 1,
    respuestasResena: [],
    secuenciaAlerta: 900_000,
    reportesCurso: [],
  };
}

function normalizar(raw: Partial<EstadoRespaldo041> | null | undefined): EstadoRespaldo041 {
  return {
    personas: raw?.personas ?? {},
    tokensCorreo: raw?.tokensCorreo ?? [],
    secuenciaRespuesta: raw?.secuenciaRespuesta ?? 1,
    respuestasResena: raw?.respuestasResena ?? [],
    secuenciaAlerta: raw?.secuenciaAlerta ?? 900_000,
    reportesCurso: raw?.reportesCurso ?? [],
  };
}

function desdeBytes(bytes: Buffer | null | undefined): EstadoRespaldo041 {
  if (!bytes) return estadoInicial();
  try {
    return normalizar(JSON.parse(bytes.toString('utf8')) as Partial<EstadoRespaldo041>);
  } catch {
    return estadoInicial();
  }
}

function leerArchivo(): EstadoRespaldo041 {
  const archivo = rutaArchivo();
  if (!existsSync(archivo)) return estadoInicial();
  try {
    return desdeBytes(readFileSync(archivo));
  } catch {
    return estadoInicial();
  }
}

function escribirArchivo(estado: EstadoRespaldo041): void {
  try {
    writeFileSync(rutaArchivo(), JSON.stringify(estado), 'utf8');
  } catch {
    // Disco efímero o sin permisos: el dato ya quedó (o no) en archivo_binario.
  }
}

/** La tabla de respaldo no existe o `learnity_app` no puede usarla: se trabaja con el archivo temporal. */
function sinTablaRespaldo(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === '42501';
}

export async function leerRespaldo041(): Promise<EstadoRespaldo041> {
  try {
    const { rows } = await pool.query<{ bytes: Buffer }>(
      'SELECT bytes FROM archivo_binario WHERE nombre = $1',
      [NOMBRE_RESPALDO_041],
    );
    return rows[0] ? desdeBytes(rows[0].bytes) : leerArchivo();
  } catch (error) {
    if (sinTablaRespaldo(error)) return leerArchivo();
    throw error;
  }
}

/**
 * Lee, modifica y guarda el respaldo en una transacción propia con `SELECT … FOR UPDATE`, para que dos
 * peticiones simultáneas no se pisen (lectura-modificación-escritura atómica sobre la fila reservada).
 * Va en una conexión aparte a propósito: aunque la transacción que la llama haga ROLLBACK, el respaldo ya
 * quedó guardado, igual que pasaba con el archivo temporal.
 */
export async function guardarRespaldo041(
  mutador: (estado: EstadoRespaldo041) => void,
): Promise<EstadoRespaldo041> {
  let cliente;
  try {
    cliente = await pool.connect();
  } catch {
    const estado = leerArchivo();
    mutador(estado);
    escribirArchivo(estado);
    return estado;
  }
  try {
    await cliente.query('BEGIN');
    await cliente.query(
      `INSERT INTO archivo_binario (nombre, bytes) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING`,
      [NOMBRE_RESPALDO_041, Buffer.from(JSON.stringify(leerArchivo()), 'utf8')],
    );
    const { rows } = await cliente.query<{ bytes: Buffer }>(
      'SELECT bytes FROM archivo_binario WHERE nombre = $1 FOR UPDATE',
      [NOMBRE_RESPALDO_041],
    );
    const estado = desdeBytes(rows[0]?.bytes);
    mutador(estado);
    await cliente.query(
      'UPDATE archivo_binario SET bytes = $2, creado_en = now() WHERE nombre = $1',
      [NOMBRE_RESPALDO_041, Buffer.from(JSON.stringify(estado), 'utf8')],
    );
    await cliente.query('COMMIT');
    escribirArchivo(estado);
    return estado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    if (!sinTablaRespaldo(error)) throw error;
    const estado = leerArchivo();
    mutador(estado);
    escribirArchivo(estado);
    return estado;
  } finally {
    cliente.release();
  }
}

/** Solo para pruebas: olvida la detección cacheada. */
export function reiniciarDeteccion041(valor: boolean | null = null): void {
  cacheTiene041 = valor;
}

export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) return null;
  const [anioStr, mesStr, diaStr] = fechaNacimiento.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - anio;
  const mesActual = hoy.getUTCMonth() + 1;
  const diaActual = hoy.getUTCDate();
  if (mesActual < mes || (mesActual === mes && diaActual < dia)) {
    edad -= 1;
  }
  return edad >= 0 ? edad : null;
}
