import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env } from '../config/env.js';

let cacheTiene041: boolean | null = null;

export interface EjecutorConsulta041 {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parametros?: unknown[],
  ) => Promise<{ rows: T[] }>;
}

export async function tieneMigracion041(ejecutor: EjecutorConsulta041): Promise<boolean> {
  if (cacheTiene041 !== null) return cacheTiene041;
  try {
    const { rows } = await ejecutor.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'persona' AND column_name = 'pais'
       ) AS ok`,
    );
    cacheTiene041 = Boolean(rows[0]?.ok);
    return cacheTiene041;
  } catch {
    return false;
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

interface EstadoRespaldo041 {
  personas: Record<string, DatosExtraPersona041>;
  tokensCorreo: TokenCambioCorreo041[];
  secuenciaRespuesta: number;
  respuestasResena: RespuestaResena041[];
  secuenciaAlerta: number;
  reportesCurso: ReporteCurso041[];
}

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

export function leerRespaldo041(): EstadoRespaldo041 {
  const archivo = rutaArchivo();
  if (!existsSync(archivo)) return estadoInicial();
  try {
    const raw = JSON.parse(readFileSync(archivo, 'utf8')) as Partial<EstadoRespaldo041>;
    return {
      personas: raw.personas ?? {},
      tokensCorreo: raw.tokensCorreo ?? [],
      secuenciaRespuesta: raw.secuenciaRespuesta ?? 1,
      respuestasResena: raw.respuestasResena ?? [],
      secuenciaAlerta: raw.secuenciaAlerta ?? 900_000,
      reportesCurso: raw.reportesCurso ?? [],
    };
  } catch {
    return estadoInicial();
  }
}

export function guardarRespaldo041(mutador: (estado: EstadoRespaldo041) => void): EstadoRespaldo041 {
  const estado = leerRespaldo041();
  mutador(estado);
  try {
    writeFileSync(rutaArchivo(), JSON.stringify(estado), 'utf8');
  } catch {
    // Si no se puede escribir en tmp, continúa en memoria de la llamada.
  }
  return estado;
}

export function esFaltaMigracion041(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42703' || code === '42P01' || code === '42883' || code === '23514' || code === '22001';
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
