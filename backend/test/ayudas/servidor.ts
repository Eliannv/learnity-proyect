// Arranca la app real en un puerto efímero y ofrece pedir() con fetch (caja negra, por HTTP).
// Importar DESPUÉS de ./guardia-bd.js. La app se importa de forma dinámica: así la suite puede
// fijar process.env.PDF_DIR (carpeta temporal propia) antes de que env.ts lea la configuración.
import type { AddressInfo } from 'node:net';

export interface OpcionesPeticion {
  token?: string | null;
  metodo?: string;
  cuerpo?: unknown;
  /** Cuerpo en bruto (para JSON mal formado, text/plain o multipart). */
  crudo?: RequestInit["body"];
  headers?: Record<string, string>;
}

export interface Respuesta {
  status: number;
  headers: Headers;
  texto: string;
  json: any;
}

export interface Servidor {
  base: string;
  pedir(ruta: string, opciones?: OpcionesPeticion): Promise<Respuesta>;
  cerrar(): Promise<void>;
}

export async function iniciarServidor(): Promise<Servidor> {
  const { crearApp } = await import('../../src/app.js');
  const http = crearApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => http.once('listening', r));
  const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;

  async function pedir(ruta: string, o: OpcionesPeticion = {}): Promise<Respuesta> {
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.token) headers['authorization'] = `Bearer ${o.token}`;
    let body: RequestInit["body"] = o.crudo;
    if (o.cuerpo !== undefined) {
      headers['content-type'] ??= 'application/json';
      body = JSON.stringify(o.cuerpo);
    }
    const res = await fetch(base + ruta, { method: o.metodo ?? 'GET', headers, body, redirect: 'manual' });
    const texto = await res.text();
    let json: any = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { /* no es JSON */ }
    return { status: res.status, headers: res.headers, texto, json };
  }

  return {
    base,
    pedir,
    cerrar: () => new Promise<void>((r) => { http.closeAllConnections?.(); http.close(() => r()); }),
  };
}
