import { env } from '../../../shared/config/env.js';
import { AppError } from '../../../shared/http/app-error.js';

const indisponible = () =>
  new AppError(
    503,
    'El almacén de grabaciones no está disponible. Reintenta en un momento.',
    'ALMACEN_NO_DISPONIBLE',
  );
const ruta = (clave: string, numero: number) => `grabaciones/${clave}/${numero}.bin`;

/** Solo la API conoce la clave del servidor. El alumno recibe bytes autorizados por Learnity. */
async function pedir(ruta: string, opciones: RequestInit = {}) {
  const clave = env.VIDEO_SUPABASE_CLAVE,
    origen = env.VIDEO_SUPABASE_URL;
  if (!clave || !origen) throw indisponible();
  const headers = new Headers(opciones.headers);
  headers.set('apikey', clave);
  headers.set('Cache-Control', 'private, no-store');
  if (!clave.startsWith('sb_secret_')) headers.set('Authorization', 'Bearer ' + clave);
  try {
    const r = await fetch(origen + '/storage/v1/' + ruta, {
      ...opciones,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      await r.body?.cancel();
      throw indisponible();
    }
    return r;
  } catch {
    throw indisponible();
  }
}

export const storagePrivado = {
  async comprobarBucket(bucket: string) {
    const r = await pedir('bucket/' + encodeURIComponent(bucket));
    const datos = (await r.json().catch(() => null)) as { id: string; public: boolean } | null;
    if (datos?.id !== bucket || datos.public !== false) {
      throw new AppError(
        503,
        'El almacén de grabaciones debe utilizar un bucket privado.',
        'BUCKET_NO_PRIVADO',
      );
    }
  },
  async guardar(bucket: string, clave: string, numero: number, bytes: Buffer) {
    const r = await pedir(`object/${encodeURIComponent(bucket)}/${ruta(clave, numero)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'cache-control': 'private, no-store',
        'x-upsert': 'true',
      },
      body: new Uint8Array(bytes),
    });
    await r.body?.cancel();
  },
  async leer(bucket: string, clave: string, numero: number, tamano: number) {
    const r = await pedir(`object/${encodeURIComponent(bucket)}/${ruta(clave, numero)}`);
    const stream = r.body?.getReader();
    if (!stream) throw indisponible();
    const bytes = Buffer.alloc(tamano);
    let recibidos = 0;
    try {
      while (true) {
        const { done, value } = await stream.read();
        if (done) break;
        if (recibidos + value.length > tamano) {
          await stream.cancel();
          throw indisponible();
        }
        bytes.set(value, recibidos);
        recibidos += value.length;
      }
      if (recibidos !== tamano) throw indisponible();
      return bytes;
    } catch {
      throw indisponible();
    } finally {
      stream.releaseLock();
    }
  },
  async retirar(bucket: string, clave: string, partes: number) {
    const r = await pedir('object/' + encodeURIComponent(bucket), {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: Array.from({ length: partes }, (_, i) => ruta(clave, i)) }),
    });
    await r.body?.cancel();
  },
};
